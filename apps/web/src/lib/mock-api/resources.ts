import type { Resource } from '@devstudy/shared';
import { RESOURCES } from '../seed/resources';
import { delay, ApiError } from './common';

export interface ResourceFilter {
  q?: string;
  topic?: string;
  type?: string;
  source?: string;
}

export async function listResources(f: ResourceFilter = {}): Promise<Resource[]> {
  await delay();
  return RESOURCES.filter((r) => {
    if (f.q && !(r.title + r.description + r.tags.join(' ')).toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.topic && r.topic !== f.topic) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.source && r.source !== f.source) return false;
    return true;
  });
}

export async function getResource(id: string): Promise<Resource> {
  await delay(200);
  const r = RESOURCES.find((x) => x.id === id);
  if (!r) throw new ApiError(404, 'Không tìm thấy tài liệu');
  return r;
}

export async function reportResource(resourceId: string, reason: string, detail: string): Promise<{ ok: boolean }> {
  await delay();
  void resourceId;
  void reason;
  void detail;
  return { ok: true };
}
