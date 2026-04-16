import EditableOptionListPage from '../components/EditableOptionListPage';
import { DEFAULT_ACTIONS_TAKEN } from '../data/actionsTaken';

export default function ActionsTakenPage(props: { actionsTaken: string[]; onChange: (next: string[]) => void }) {
  const { actionsTaken, onChange } = props;
  return (
    <EditableOptionListPage
      title="Actions Taken"
      description="Edit the action chips staff can select when logging an incident (e.g. &quot;Parents notified&quot;). At least one action is required; clearing the list restores defaults."
      newItemLabel="New action"
      itemLabelPrefix="Action"
      deleteAriaLabel="Delete action"
      items={actionsTaken}
      fallbackItems={DEFAULT_ACTIONS_TAKEN}
      onChange={onChange}
    />
  );
}
