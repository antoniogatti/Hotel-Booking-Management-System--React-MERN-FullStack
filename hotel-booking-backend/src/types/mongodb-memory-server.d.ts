declare module "mongodb-memory-server" {
  export class MongoMemoryServer {
    static create(options?: {
      instance?: {
        dbName?: string;
      };
    }): Promise<MongoMemoryServer>;

    getUri(): string;
    stop(): Promise<void>;
  }
}