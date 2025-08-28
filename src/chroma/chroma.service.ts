import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ChromaClient } from 'chromadb';

@Injectable()
export class ChromaService implements OnModuleInit, OnModuleDestroy {
  private client: ChromaClient;

  async onModuleInit() {
    this.client = new ChromaClient();
    await this.client.heartbeat();
    console.log('✅ Connected to ChromaDB');
  }

  getClient(): ChromaClient {
    return this.client;
  }

  async onModuleDestroy() {
    console.log('🛑 ChromaDB client closed');
  }
}
