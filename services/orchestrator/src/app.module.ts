import { Module } from "@nestjs/common";

import { PassiveDetectorClient } from "./clients/detectors.client.js";
import { ProvenanceClient } from "./clients/provenance.client.js";
import { SynthIdClient } from "./clients/synthid.client.js";
import { InspectController } from "./controllers/inspect.controller.js";
import { ReportController } from "./controllers/report.controller.js";
import { HealthController } from "./controllers/health.controller.js";
import { loadConfig } from "./config.js";
import { InspectionService } from "./services/inspection.service.js";
import { APP_CONFIG, AUDIT_REPOSITORY, STORAGE_SERVICE } from "./tokens.js";
import { InMemoryAuditRepository } from "./repository/memory.repository.js";
import { PostgresAuditRepository } from "./repository/postgres.repository.js";
import { InMemoryStorageService } from "./storage/memory.storage.js";
import { S3StorageService } from "./storage/s3.storage.js";

const configProvider = {
  provide: APP_CONFIG,
  useFactory: () => loadConfig(),
};

const storageProvider = {
  provide: STORAGE_SERVICE,
  inject: [APP_CONFIG],
  useFactory: (config: ReturnType<typeof loadConfig>) => {
    if (config.objectStorage.bucket) {
      return new S3StorageService(config.objectStorage);
    }
    return new InMemoryStorageService();
  },
};

const repositoryProvider = {
  provide: AUDIT_REPOSITORY,
  inject: [APP_CONFIG],
  useFactory: async (config: ReturnType<typeof loadConfig>) => {
    if (config.database.url) {
      const repo = new PostgresAuditRepository(config.database.url);
      await repo.init();
      return repo;
    }
    return new InMemoryAuditRepository();
  },
};

@Module({
  imports: [],
  controllers: [InspectController, ReportController, HealthController],
  providers: [
    configProvider,
    storageProvider,
    repositoryProvider,
    InspectionService,
    PassiveDetectorClient,
    ProvenanceClient,
    SynthIdClient,
  ],
})
export class AppModule {}
