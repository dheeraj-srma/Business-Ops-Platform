import ModulePage from '../components/ModulePage';

export default function InwardsPage() {
  return (
    <ModulePage
      title="Inwards"
      subtitle="Record incoming stock receipts."
      endpoint="/api/inwards"
    />
  );
}
