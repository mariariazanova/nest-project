import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { FileItem } from '../interfaces/favorites';
import { createTsRestClient } from '../ts-rest-client';

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly api = createTsRestClient();

  upload(
    file: File,
    entityType: string,
    entityId: string,
  ): Observable<FileItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    return from(this.api.file.upload({ body: formData as any })).pipe(
      map((res) => {
        if (res.status >= 400) throw { status: res.status };
        return res.body as unknown as FileItem;
      }),
    );
  }

  getByEntity(entityType: string, entityId: string): Observable<FileItem[]> {
    return from(
      this.api.file.getByEntity({ query: { entityType, entityId } }),
    ).pipe(map(({ body }) => body as unknown as FileItem[]));
  }

  // Returns a short-lived signed URL; caller navigates to it — browser handles download
  download(fileId: string): Observable<string> {
    return from(this.api.file.download({ params: { id: fileId } })).pipe(
      map(({ body }) => (body as any).downloadUrl as string),
    );
  }

  delete(fileId: string): Observable<void> {
    return from(this.api.file.delete({ params: { id: fileId } })).pipe(
      map(() => void 0),
    );
  }
}
