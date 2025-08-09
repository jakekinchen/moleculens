import 'server-only';

async function getMeta(spec_id: string) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL || ''}/api/figure/${spec_id}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}

export default async function FigurePage(props: { params: Promise<{ spec_id: string }> }) {
  const { spec_id } = await props.params;
  const data = await getMeta(spec_id);
  if (!data || data.status !== 'completed') {
    return <pre>spec_id: {spec_id}{"\n"}status: {data?.status ?? 'unknown'}</pre>;
  }
  const urls = data.urls || {};
  return (
    <div className="p-4">
      <h1 className="font-semibold">Figure {spec_id}</h1>
      {urls.svg2d && <object data={urls.svg2d} type="image/svg+xml" width="800" height="600" />}
      {urls.png3d && <img src={urls.png3d} alt="3D" width={800} />}
      <pre className="mt-4">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}


