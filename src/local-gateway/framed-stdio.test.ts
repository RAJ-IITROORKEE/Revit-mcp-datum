import assert from "node:assert/strict";
import test from "node:test";
import { PassThrough } from "node:stream";
import {
  MAX_FRAME_BYTES,
  FrameProtocolError,
  FramedJsonReader,
  FramedStdioServerTransport,
  encodeJsonFrame,
} from "./framed-stdio.js";

function reader() {
  const values: unknown[] = [];
  const errors: FrameProtocolError[] = [];
  const framed = new FramedJsonReader({
    maxFrameBytes: 1024,
    onValue: (value) => values.push(value),
    onError: (error) => errors.push(error),
  });
  return { framed, values, errors };
}

test("framed stdio accepts fragmented and coalesced JSON frames", () => {
  const fragmented = reader();
  const first = encodeJsonFrame({ id: 1 }, 1024);
  for (const byte of first) fragmented.framed.push(Buffer.from([byte]));
  fragmented.framed.end();
  assert.deepEqual(fragmented.values, [{ id: 1 }]);
  assert.deepEqual(fragmented.errors, []);

  const coalesced = reader();
  coalesced.framed.push(Buffer.concat([
    encodeJsonFrame({ id: 2 }, 1024),
    encodeJsonFrame({ id: 3 }, 1024),
  ]));
  coalesced.framed.end();
  assert.deepEqual(coalesced.values, [{ id: 2 }, { id: 3 }]);
  assert.deepEqual(coalesced.errors, []);
});

test("framed stdio rejects zero and oversized lengths before reading a body", () => {
  for (const length of [0, 1025]) {
    const { framed, values, errors } = reader();
    const header = Buffer.alloc(4);
    header.writeUInt32BE(length);
    framed.push(header);
    assert.deepEqual(values, []);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, length === 0 ? "ZERO_LENGTH_FRAME" : "FRAME_TOO_LARGE");
  }
});

test("framed stdio rejects truncated and malformed JSON frames", () => {
  const truncated = reader();
  const complete = encodeJsonFrame({ id: 1 }, 1024);
  truncated.framed.push(complete.subarray(0, complete.length - 1));
  truncated.framed.end();
  assert.equal(truncated.errors[0]?.code, "TRUNCATED_FRAME");

  const malformed = reader();
  const body = Buffer.from("{not-json", "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length);
  malformed.framed.push(Buffer.concat([header, body]));
  assert.equal(malformed.errors[0]?.code, "MALFORMED_JSON");
  assert.deepEqual(malformed.values, []);
});

test("framed stdio rejects invalid UTF-8 and unserializable values", () => {
  const invalidUtf8 = reader();
  const header = Buffer.alloc(4);
  header.writeUInt32BE(2);
  invalidUtf8.framed.push(Buffer.concat([header, Buffer.from([0xc3, 0x28])]));
  assert.equal(invalidUtf8.errors[0]?.code, "MALFORMED_JSON");
  assert.deepEqual(invalidUtf8.values, []);

  assert.throws(
    () => encodeJsonFrame({ value: 1n }, 1024),
    (error: unknown) => error instanceof FrameProtocolError && error.code === "MALFORMED_JSON",
  );
});

test("the production frame ceiling never exceeds 8 MiB", () => {
  assert.equal(MAX_FRAME_BYTES, 8 * 1024 * 1024);
  assert.throws(
    () => encodeJsonFrame({ value: "x".repeat(1024) }, 32),
    (error: unknown) => error instanceof FrameProtocolError && error.code === "FRAME_TOO_LARGE",
  );
});

test("bounded framed stdio implements the MCP transport contract", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const transport = new FramedStdioServerTransport(input, output, 1024);
  const received: unknown[] = [];
  transport.onmessage = (message) => received.push(message);
  await transport.start();

  input.write(encodeJsonFrame({ jsonrpc: "2.0", id: 1, method: "ping" }, 1024));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(received, [{ jsonrpc: "2.0", id: 1, method: "ping" }]);

  const written: unknown[] = [];
  const outputReader = new FramedJsonReader({
    maxFrameBytes: 1024,
    onValue: (value) => written.push(value),
    onError: (error) => { throw error; },
  });
  output.on("data", (chunk) => outputReader.push(Buffer.from(chunk)));
  await transport.send({ jsonrpc: "2.0", id: 1, result: {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(written, [{ jsonrpc: "2.0", id: 1, result: {} }]);
  await transport.close();
});
