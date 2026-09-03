import { PageHeader } from "../ui";

export function StubPage({ title, detail }: { title: string; form?: string; detail: string }) {
  return (
    <div>
      <PageHeader title={title}>{detail}</PageHeader>
    </div>
  );
}
