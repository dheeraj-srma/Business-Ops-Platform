import ModulePage from '../components/ModulePage';

export default function SuppliersPage() {
  return (
    <ModulePage
      title="Suppliers"
      subtitle="Supplier directory, contact details, and orders."
      endpoint="/api/suppliers"
    />
  );
}
