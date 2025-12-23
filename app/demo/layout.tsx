export const dynamic = 'force-dynamic';

export default async function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Demo mode: no auth required
  return <>{children}</>;
}

