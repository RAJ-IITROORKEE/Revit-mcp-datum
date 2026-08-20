import process from "node:process";
import type { Readable, Writable } from "node:stream";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessageSchema, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export const MAX_FRAME_BYTES = 8 * 1024 * 1024;

export type FrameProtocolErrorCode =
  | "ZERO_LENGTH_FRAME"
  | "FRAME_TOO_LARGE"
  | "TRUNCATED_FRAME"
  | "MALFORMED_JSON";

export class FrameProtocolError extends Error {
  constructor(public readonly code: FrameProtocolErrorCode, message: string) {
    super(message);
    this.name = "FrameProtocolError";
  }
}

type FramedJsonReaderOptions = {
  maxFrameBytes?: number;
  onValue: (value: unknown) => void;
  onError: (error: FrameProtocolError) => void;
};

export class FramedJsonReader {
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private readonly header = Buffer.allocUnsafe(4);
  private headerBytes = 0;
  private body: Buffer | undefined;
  private bodyBytes = 0;
  private failed = false;
  private readonly maxFrameBytes: number;

  constructor(private readonly options: FramedJsonReaderOptions) {
    this.maxFrameBytes = options.maxFrameBytes ?? MAX_FRAME_BYTES;
    if (!Number.isInteger(this.maxFrameBytes) || this.maxFrameBytes <= 0 || this.maxFrameBytes > MAX_FRAME_BYTES) {
      throw new RangeError(`maxFrameBytes must be between 1 and ${MAX_FRAME_BYTES}`);
    }
  }

  push(chunk: Buffer): void {
    if (this.failed || chunk.length === 0) return;
    let offset = 0;
    while (offset < chunk.length && !this.failed) {
      if (!this.body) {
        const headerRemaining = 4 - this.headerBytes;
        const copied = Math.min(headerRemaining, chunk.length - offset);
        chunk.copy(this.header, this.headerBytes, offset, offset + copied);
        this.headerBytes += copied;
        offset += copied;
        if (this.headerBytes < 4) continue;

        const length = this.header.readUInt32BE(0);
        if (length === 0) {
          this.fail(new FrameProtocolError("ZERO_LENGTH_FRAME", "Zero-length frames are not allowed"));
          return;
        }
        if (length > this.maxFrameBytes) {
          this.fail(new FrameProtocolError("FRAME_TOO_LARGE", `Frame exceeds ${this.maxFrameBytes} bytes`));
          return;
        }
        // Allocate only after the complete header has passed both length checks.
        this.body = Buffer.allocUnsafe(length);
        this.bodyBytes = 0;
      }

      const bodyRemaining = this.body.length - this.bodyBytes;
      const copied = Math.min(bodyRemaining, chunk.length - offset);
      chunk.copy(this.body, this.bodyBytes, offset, offset + copied);
      this.bodyBytes += copied;
      offset += copied;
      if (this.bodyBytes !== this.body.length) continue;

      const completeBody = this.body;
      this.body = undefined;
      this.bodyBytes = 0;
      this.headerBytes = 0;
      try {
        this.options.onValue(JSON.parse(this.decoder.decode(completeBody)) as unknown);
      } catch {
        this.fail(new FrameProtocolError("MALFORMED_JSON", "Frame body must be valid UTF-8 JSON"));
      }
    }
  }

  end(): void {
    if (!this.failed && (this.headerBytes !== 0 || this.body !== undefined)) {
      this.fail(new FrameProtocolError("TRUNCATED_FRAME", "Input ended with an incomplete frame"));
    }
  }

  private fail(error: FrameProtocolError): void {
    this.failed = true;
    this.body = undefined;
    this.options.onError(error);
  }
}

export function encodeJsonFrame(value: unknown, maxFrameBytes = MAX_FRAME_BYTES): Buffer {
  if (!Number.isInteger(maxFrameBytes) || maxFrameBytes <= 0 || maxFrameBytes > MAX_FRAME_BYTES) {
    throw new RangeError(`maxFrameBytes must be between 1 and ${MAX_FRAME_BYTES}`);
  }
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new FrameProtocolError("MALFORMED_JSON", "Frame value must be JSON serializable");
  }
  if (serialized === undefined) {
    throw new FrameProtocolError("MALFORMED_JSON", "Frame value must be JSON serializable");
  }
  const body = Buffer.from(serialized, "utf8");
  if (body.length === 0) throw new FrameProtocolError("ZERO_LENGTH_FRAME", "Zero-length frames are not allowed");
  if (body.length > maxFrameBytes) {
    throw new FrameProtocolError("FRAME_TOO_LARGE", `Frame exceeds ${maxFrameBytes} bytes`);
  }
  const frame = Buffer.allocUnsafe(4 + body.length);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, 4);
  return frame;
}

export class FramedStdioServerTransport implements Transport {
  private started = false;
  private closed = false;
  private readonly reader: FramedJsonReader;
  private resolveClosed!: () => void;
  readonly closedPromise = new Promise<void>((resolve) => { this.resolveClosed = resolve; });

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(
    private readonly input: Readable = process.stdin,
    private readonly output: Writable = process.stdout,
    private readonly maxFrameBytes = MAX_FRAME_BYTES,
  ) {
    this.reader = new FramedJsonReader({
      maxFrameBytes,
      onValue: (value) => {
        const parsed = JSONRPCMessageSchema.safeParse(value);
        if (!parsed.success) {
          this.fail(new FrameProtocolError("MALFORMED_JSON", "Frame body must contain a valid MCP JSON-RPC message"));
          return;
        }
        this.onmessage?.(parsed.data);
      },
      onError: (error) => this.fail(error),
    });
  }

  async start(): Promise<void> {
    if (this.started) throw new Error("Framed stdio transport already started");
    if (this.closed) throw new Error("Framed stdio transport is closed");
    this.started = true;
    this.input.on("data", this.handleData);
    this.input.on("end", this.handleEnd);
    this.input.on("error", this.handleInputError);
    this.output.on("error", this.handleOutputError);
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.started || this.closed) throw new Error("Framed stdio transport is not open");
    const frame = encodeJsonFrame(message, this.maxFrameBytes);
    await new Promise<void>((resolve, reject) => {
      this.output.write(frame, (error) => error ? reject(error) : resolve());
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.input.off("data", this.handleData);
    this.input.off("end", this.handleEnd);
    this.input.off("error", this.handleInputError);
    this.output.off("error", this.handleOutputError);
    this.input.pause();
    this.resolveClosed();
    this.onclose?.();
  }

  private readonly handleData = (chunk: Buffer | string): void => {
    this.reader.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  };

  private readonly handleEnd = (): void => {
    this.reader.end();
    void this.close();
  };

  private readonly handleInputError = (error: Error): void => this.fail(error);
  private readonly handleOutputError = (error: Error): void => this.fail(error);

  private fail(error: Error): void {
    if (this.closed) return;
    this.onerror?.(error);
    void this.close();
  }
}
