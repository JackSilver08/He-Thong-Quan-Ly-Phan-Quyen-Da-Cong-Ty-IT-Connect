import type { Segment } from '@/lib/audit';

/** Hiển thị câu mô tả hoạt động, in đậm tên đối tượng. */
export function AuditText({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((segment, index) => (typeof segment === 'string' ? <span key={index}>{segment}</span> : <strong key={index}>{segment.strong}</strong>))}
    </>
  );
}
