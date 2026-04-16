import EditableOptionListPage from '../components/EditableOptionListPage';
import { DEFAULT_LOCATIONS } from '../data/locations';

export default function LocationsPage(props: {
  locations: string[];
  onChange: (next: string[]) => void;
}) {
  const { locations, onChange } = props;
  return (
    <EditableOptionListPage
      title="Incident Locations"
      description="Add or edit location options used when logging incidents."
      newItemLabel="New location"
      itemLabelPrefix="Location"
      deleteAriaLabel="Delete location"
      items={locations}
      fallbackItems={DEFAULT_LOCATIONS}
      onChange={onChange}
    />
  );
}

