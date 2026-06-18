import { Injectable, signal } from '@angular/core';
import { baseBackEndUrl } from '../constants/urls';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private links = signal<Record<string, string>>({});

  setLinks(links: Record<string, string>): void {
    this.links.set(links);
  }

  getLink(name: string): string | null {
    const link = this.links()[name];
    if (!link) return null;

    if (link.startsWith('http')) return link;

    const path = link.replace(/^\/v1\//, '');
    return `${baseBackEndUrl}${path}`;
  }
}
