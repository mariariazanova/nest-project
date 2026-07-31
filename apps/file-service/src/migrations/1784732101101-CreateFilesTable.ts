import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFilesTable1784732101101 implements MigrationInterface {
  name = 'CreateFilesTable1784732101101';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "files" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "originalName" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "size" bigint NOT NULL,
        "storagePath" character varying NOT NULL,
        "uploadedBy" character varying NOT NULL,
        "entityType" character varying,
        "entityId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_files" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20c2e6aeb3fe09613808ba1eab" ON "files" ("entityType", "entityId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_20c2e6aeb3fe09613808ba1eab"`,
    );
    await queryRunner.query(`DROP TABLE "files"`);
  }
}
