import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1783077978077 implements MigrationInterface {
  name = 'InitialSchema1783077978077';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "games" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" character varying, "publisher" character varying, "year" integer, CONSTRAINT "PK_c9b16b62917b5595af982d66337" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_06734e8b047d4cd535598fcde0" ON "games"  ("title") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c5a0fe385651d7d2aa20afe869" ON "games"  ("year") `,
    );
    await queryRunner.query(
      `CREATE TABLE "event_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "UQ_5df196f818afbc82f75a1879ec5" UNIQUE ("name"), CONSTRAINT "PK_c5675e66b601bd4d0882054a430" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "songs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "singer" character varying NOT NULL, "description" character varying, CONSTRAINT "PK_e504ce8ad2e291d3a1d8f1ea2f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e84a24f0f8d94d5699f32797fb" ON "songs"  ("title") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5dbbd39ebea494be110bd56120" ON "songs"  ("singer") `,
    );
    await queryRunner.query(
      `CREATE TABLE "genre_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "UQ_94d44334b268391c7b80403b760" UNIQUE ("name"), CONSTRAINT "PK_cae0cec334ef1e35fe187160f0d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "films" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" character varying, "director" character varying, "year" integer, CONSTRAINT "PK_697487ada088902377482c970d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ef6e0245decf772d1dd66f158a" ON "films"  ("title") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_404c09392e6e0539cb8fdfbd3c" ON "films"  ("director") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac98219bc50a5f811c6d388fd5" ON "films"  ("year") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mood_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "UQ_46ff9bb150e33cae20d43db8940" UNIQUE ("name"), CONSTRAINT "PK_a3beea07137616eaad9b0940986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "books" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "author" character varying NOT NULL, "description" character varying, CONSTRAINT "PK_f3f2f25a099d24e12545b70b022" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3cd818eaf734a9d8814843f119" ON "books"  ("title") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4675aad2c57a7a793d26afbae9" ON "books"  ("author") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_suggestion_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mediaType" character varying NOT NULL, "mediaId" uuid NOT NULL, "userSuggestionId" uuid, CONSTRAINT "PK_ecfe31fd675cb1b2280bad8134a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ee1a245a511091956eb410651e" ON "user_suggestion_categories"  ("mediaType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e9e354c59690c4a2ee642f0ac" ON "user_suggestion_categories"  ("mediaId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_suggestions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "criteria" jsonb NOT NULL, "recommendedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_9b553b6d240963985346c3f26a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "game_moods" ("game_id" uuid NOT NULL, "mood_id" uuid NOT NULL, CONSTRAINT "PK_73b8dbf189893bd057d4e98b8cb" PRIMARY KEY ("game_id", "mood_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_61e80e8c314b74b7a248a97910" ON "game_moods"  ("game_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7c885f7faf199fd2d461780a69" ON "game_moods"  ("mood_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "game_genres" ("game_id" uuid NOT NULL, "genre_id" uuid NOT NULL, CONSTRAINT "PK_f437c920291d8ecfe5c2fef3545" PRIMARY KEY ("game_id", "genre_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97ffde1c44043f6ab2c74c762e" ON "game_genres"  ("game_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ca05b7be44292eb05a1842bbeb" ON "game_genres"  ("genre_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "game_events" ("game_id" uuid NOT NULL, "event_id" uuid NOT NULL, CONSTRAINT "PK_05484de73b537efe48e6a623203" PRIMARY KEY ("game_id", "event_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5e9c9173e6d21d06023146b42e" ON "game_events"  ("game_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_52392db00c94801e9de4eaa5e7" ON "game_events"  ("event_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "song_moods" ("song_id" uuid NOT NULL, "mood_id" uuid NOT NULL, CONSTRAINT "PK_07329fa514f1a7b7a9d5fc79232" PRIMARY KEY ("song_id", "mood_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7f287836a5da420f9cc536649a" ON "song_moods"  ("song_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f6664d31b7d99ce7c5ff5b14f" ON "song_moods"  ("mood_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "song_genres" ("song_id" uuid NOT NULL, "genre_id" uuid NOT NULL, CONSTRAINT "PK_e7bb356590d4c924cb6c5572a83" PRIMARY KEY ("song_id", "genre_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_de404f71e84126a4c84b405d4a" ON "song_genres"  ("song_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40fd43fbac798c136dc175fc75" ON "song_genres"  ("genre_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "song_events" ("song_id" uuid NOT NULL, "event_id" uuid NOT NULL, CONSTRAINT "PK_467a9dbbc6c582d9a565ea9184e" PRIMARY KEY ("song_id", "event_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_504eaecdf0989fea30573d2b8f" ON "song_events"  ("song_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_147cec2739c485e50beec24c30" ON "song_events"  ("event_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "film_moods" ("film_id" uuid NOT NULL, "mood_id" uuid NOT NULL, CONSTRAINT "PK_aaa5019e39c1adea3896bcb0744" PRIMARY KEY ("film_id", "mood_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1fc04f03919744ad9af93cee56" ON "film_moods"  ("film_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e64095a7159045eb79a0a39077" ON "film_moods"  ("mood_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "film_genres" ("film_id" uuid NOT NULL, "genre_id" uuid NOT NULL, CONSTRAINT "PK_fd12866d0d5a8fdf24844a964ac" PRIMARY KEY ("film_id", "genre_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9b6ca3be1e09e7537b24144d21" ON "film_genres"  ("film_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d273e8fd854a03f655a751f393" ON "film_genres"  ("genre_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "film_events" ("film_id" uuid NOT NULL, "event_id" uuid NOT NULL, CONSTRAINT "PK_6a132963091c3fefea534930faa" PRIMARY KEY ("film_id", "event_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a1338547c61ce6f6ec4c584af" ON "film_events"  ("film_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2152092e91c2c2165742ae7881" ON "film_events"  ("event_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "book_moods" ("book_id" uuid NOT NULL, "mood_id" uuid NOT NULL, CONSTRAINT "PK_57e8927ed16f9a5b36c9b1db7cf" PRIMARY KEY ("book_id", "mood_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e84909231825756d7420a4a657" ON "book_moods"  ("book_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f2eec9fdb0a2a962e129129b1" ON "book_moods"  ("mood_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "book_genres" ("book_id" uuid NOT NULL, "genre_id" uuid NOT NULL, CONSTRAINT "PK_dc2d072b9d76acb4c5f2a4c55e6" PRIMARY KEY ("book_id", "genre_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dc378b8311ff85f0dd38f16309" ON "book_genres"  ("book_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_43ff7d87d7506e768ca6491a1d" ON "book_genres"  ("genre_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "book_events" ("book_id" uuid NOT NULL, "event_id" uuid NOT NULL, CONSTRAINT "PK_7b2d4f0c15b012e9af91a7b6b90" PRIMARY KEY ("book_id", "event_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9ad9bdd0f73a558eb4a89d6e5f" ON "book_events"  ("book_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_32f964b58ba430879279ffb5dc" ON "book_events"  ("event_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_suggestion_categories" ADD CONSTRAINT "FK_3327fb9c5b9a094419473dcc46c" FOREIGN KEY ("userSuggestionId") REFERENCES "user_suggestions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_suggestions" ADD CONSTRAINT "FK_52d08ccce69c59262691e942240" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_moods" ADD CONSTRAINT "FK_61e80e8c314b74b7a248a979104" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_moods" ADD CONSTRAINT "FK_7c885f7faf199fd2d461780a694" FOREIGN KEY ("mood_id") REFERENCES "mood_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_genres" ADD CONSTRAINT "FK_97ffde1c44043f6ab2c74c762ed" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_genres" ADD CONSTRAINT "FK_ca05b7be44292eb05a1842bbeb5" FOREIGN KEY ("genre_id") REFERENCES "genre_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_events" ADD CONSTRAINT "FK_5e9c9173e6d21d06023146b42e3" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_events" ADD CONSTRAINT "FK_52392db00c94801e9de4eaa5e7b" FOREIGN KEY ("event_id") REFERENCES "event_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_moods" ADD CONSTRAINT "FK_7f287836a5da420f9cc536649a8" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_moods" ADD CONSTRAINT "FK_2f6664d31b7d99ce7c5ff5b14f9" FOREIGN KEY ("mood_id") REFERENCES "mood_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_genres" ADD CONSTRAINT "FK_de404f71e84126a4c84b405d4a6" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_genres" ADD CONSTRAINT "FK_40fd43fbac798c136dc175fc75c" FOREIGN KEY ("genre_id") REFERENCES "genre_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_events" ADD CONSTRAINT "FK_504eaecdf0989fea30573d2b8f3" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_events" ADD CONSTRAINT "FK_147cec2739c485e50beec24c30e" FOREIGN KEY ("event_id") REFERENCES "event_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_moods" ADD CONSTRAINT "FK_1fc04f03919744ad9af93cee564" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_moods" ADD CONSTRAINT "FK_e64095a7159045eb79a0a390778" FOREIGN KEY ("mood_id") REFERENCES "mood_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_genres" ADD CONSTRAINT "FK_9b6ca3be1e09e7537b24144d21d" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_genres" ADD CONSTRAINT "FK_d273e8fd854a03f655a751f393e" FOREIGN KEY ("genre_id") REFERENCES "genre_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_events" ADD CONSTRAINT "FK_5a1338547c61ce6f6ec4c584af8" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_events" ADD CONSTRAINT "FK_2152092e91c2c2165742ae78813" FOREIGN KEY ("event_id") REFERENCES "event_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_moods" ADD CONSTRAINT "FK_e84909231825756d7420a4a6571" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_moods" ADD CONSTRAINT "FK_3f2eec9fdb0a2a962e129129b14" FOREIGN KEY ("mood_id") REFERENCES "mood_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_genres" ADD CONSTRAINT "FK_dc378b8311ff85f0dd38f163090" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_genres" ADD CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd" FOREIGN KEY ("genre_id") REFERENCES "genre_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_events" ADD CONSTRAINT "FK_9ad9bdd0f73a558eb4a89d6e5fa" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_events" ADD CONSTRAINT "FK_32f964b58ba430879279ffb5dc3" FOREIGN KEY ("event_id") REFERENCES "event_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "book_events" DROP CONSTRAINT "FK_32f964b58ba430879279ffb5dc3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_events" DROP CONSTRAINT "FK_9ad9bdd0f73a558eb4a89d6e5fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_genres" DROP CONSTRAINT "FK_43ff7d87d7506e768ca6491a1dd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_genres" DROP CONSTRAINT "FK_dc378b8311ff85f0dd38f163090"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_moods" DROP CONSTRAINT "FK_3f2eec9fdb0a2a962e129129b14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_moods" DROP CONSTRAINT "FK_e84909231825756d7420a4a6571"`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_events" DROP CONSTRAINT "FK_2152092e91c2c2165742ae78813"`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_events" DROP CONSTRAINT "FK_5a1338547c61ce6f6ec4c584af8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_genres" DROP CONSTRAINT "FK_d273e8fd854a03f655a751f393e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_genres" DROP CONSTRAINT "FK_9b6ca3be1e09e7537b24144d21d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_moods" DROP CONSTRAINT "FK_e64095a7159045eb79a0a390778"`,
    );
    await queryRunner.query(
      `ALTER TABLE "film_moods" DROP CONSTRAINT "FK_1fc04f03919744ad9af93cee564"`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_events" DROP CONSTRAINT "FK_147cec2739c485e50beec24c30e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_events" DROP CONSTRAINT "FK_504eaecdf0989fea30573d2b8f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_genres" DROP CONSTRAINT "FK_40fd43fbac798c136dc175fc75c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_genres" DROP CONSTRAINT "FK_de404f71e84126a4c84b405d4a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_moods" DROP CONSTRAINT "FK_2f6664d31b7d99ce7c5ff5b14f9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "song_moods" DROP CONSTRAINT "FK_7f287836a5da420f9cc536649a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_events" DROP CONSTRAINT "FK_52392db00c94801e9de4eaa5e7b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_events" DROP CONSTRAINT "FK_5e9c9173e6d21d06023146b42e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_genres" DROP CONSTRAINT "FK_ca05b7be44292eb05a1842bbeb5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_genres" DROP CONSTRAINT "FK_97ffde1c44043f6ab2c74c762ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_moods" DROP CONSTRAINT "FK_7c885f7faf199fd2d461780a694"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_moods" DROP CONSTRAINT "FK_61e80e8c314b74b7a248a979104"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_suggestions" DROP CONSTRAINT "FK_52d08ccce69c59262691e942240"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_suggestion_categories" DROP CONSTRAINT "FK_3327fb9c5b9a094419473dcc46c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_32f964b58ba430879279ffb5dc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9ad9bdd0f73a558eb4a89d6e5f"`,
    );
    await queryRunner.query(`DROP TABLE "book_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_43ff7d87d7506e768ca6491a1d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dc378b8311ff85f0dd38f16309"`,
    );
    await queryRunner.query(`DROP TABLE "book_genres"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3f2eec9fdb0a2a962e129129b1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e84909231825756d7420a4a657"`,
    );
    await queryRunner.query(`DROP TABLE "book_moods"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2152092e91c2c2165742ae7881"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a1338547c61ce6f6ec4c584af"`,
    );
    await queryRunner.query(`DROP TABLE "film_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d273e8fd854a03f655a751f393"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9b6ca3be1e09e7537b24144d21"`,
    );
    await queryRunner.query(`DROP TABLE "film_genres"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e64095a7159045eb79a0a39077"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1fc04f03919744ad9af93cee56"`,
    );
    await queryRunner.query(`DROP TABLE "film_moods"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_147cec2739c485e50beec24c30"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_504eaecdf0989fea30573d2b8f"`,
    );
    await queryRunner.query(`DROP TABLE "song_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40fd43fbac798c136dc175fc75"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_de404f71e84126a4c84b405d4a"`,
    );
    await queryRunner.query(`DROP TABLE "song_genres"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2f6664d31b7d99ce7c5ff5b14f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7f287836a5da420f9cc536649a"`,
    );
    await queryRunner.query(`DROP TABLE "song_moods"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_52392db00c94801e9de4eaa5e7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5e9c9173e6d21d06023146b42e"`,
    );
    await queryRunner.query(`DROP TABLE "game_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ca05b7be44292eb05a1842bbeb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97ffde1c44043f6ab2c74c762e"`,
    );
    await queryRunner.query(`DROP TABLE "game_genres"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7c885f7faf199fd2d461780a69"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_61e80e8c314b74b7a248a97910"`,
    );
    await queryRunner.query(`DROP TABLE "game_moods"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "user_suggestions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2e9e354c59690c4a2ee642f0ac"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ee1a245a511091956eb410651e"`,
    );
    await queryRunner.query(`DROP TABLE "user_suggestion_categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4675aad2c57a7a793d26afbae9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3cd818eaf734a9d8814843f119"`,
    );
    await queryRunner.query(`DROP TABLE "books"`);
    await queryRunner.query(`DROP TABLE "mood_entity"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ac98219bc50a5f811c6d388fd5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_404c09392e6e0539cb8fdfbd3c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ef6e0245decf772d1dd66f158a"`,
    );
    await queryRunner.query(`DROP TABLE "films"`);
    await queryRunner.query(`DROP TABLE "genre_entity"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5dbbd39ebea494be110bd56120"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e84a24f0f8d94d5699f32797fb"`,
    );
    await queryRunner.query(`DROP TABLE "songs"`);
    await queryRunner.query(`DROP TABLE "event_entity"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c5a0fe385651d7d2aa20afe869"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_06734e8b047d4cd535598fcde0"`,
    );
    await queryRunner.query(`DROP TABLE "games"`);
  }
}
