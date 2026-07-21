import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index(['entityType', 'entityId'])
@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  // bigint in DB to support files up to 5 GB (INTEGER max is ~2.1 GB)
  @Column({
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  size: number;

  @Column()
  storagePath: string; // /uploads/{uploadedBy}/{id}/file

  @Column()
  uploadedBy: string; // userId from X-User-Id header

  @Column({ nullable: true })
  entityType?: string; // e.g. 'favorite', 'suggestion', 'user'

  @Column({ nullable: true })
  entityId?: string; // UUID of the associated entity

  @CreateDateColumn()
  createdAt: Date;
}
