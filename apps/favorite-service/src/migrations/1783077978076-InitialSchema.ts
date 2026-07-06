import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1783077978076 implements MigrationInterface {
  name = 'InitialSchema1783077978076';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."favorites_category_enum" AS ENUM('books', 'films', 'games', 'songs')`,
    );
    await queryRunner.query(
      `CREATE TABLE "favorites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "itemId" character varying NOT NULL, "category" "public"."favorites_category_enum" NOT NULL, "title" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_7b6bc801d0774c966c63207e8f2" UNIQUE ("userId", "itemId", "category"), CONSTRAINT "PK_890818d27523748dd36a4d1bdc8" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "favorites"`);
    await queryRunner.query(`DROP TYPE "public"."favorites_category_enum"`);
  }
}
