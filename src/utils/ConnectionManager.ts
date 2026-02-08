import { RevitClientConnection } from "./SocketClient.js";

/**
 * Connect to Revit client and execute operation
 * @param operation Operation function to execute after successful connection
 * @returns Result of the operation
 */
export async function withRevitConnection<T>(
  operation: (client: RevitClientConnection) => Promise<T>
): Promise<T> {
  const revitClient = new RevitClientConnection("localhost", 8080);

  try {
    // 连接到Revit客户端
    if (!revitClient.isConnected) {
      await new Promise<void>((resolve, reject) => {
        const onConnect = () => {
          revitClient.socket.removeListener("connect", onConnect);
          revitClient.socket.removeListener("error", onError);
          resolve();
        };

        const onError = (error: any) => {
          revitClient.socket.removeListener("connect", onConnect);
          revitClient.socket.removeListener("error", onError);
          reject(new Error("connect to revit client failed"));
        };

        revitClient.socket.on("connect", onConnect);
        revitClient.socket.on("error", onError);

        revitClient.connect();

        setTimeout(() => {
          revitClient.socket.removeListener("connect", onConnect);
          revitClient.socket.removeListener("error", onError);
          reject(new Error("Failed to connect to Revit client after 10 seconds"));
        }, 10000);
      });
    }

    // 执行操作
    return await operation(revitClient);
  } finally {
    // 断开连接
    revitClient.disconnect();
  }
}
