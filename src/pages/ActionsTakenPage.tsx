import React from 'react';
import {
  Box,
  Button,
  Card,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { DEFAULT_ACTIONS_TAKEN } from '../data/actionsTaken';

export default function ActionsTakenPage(props: { actionsTaken: string[]; onChange: (next: string[]) => void }) {
  const { actionsTaken, onChange } = props;
  const [newAction, setNewAction] = React.useState('');

  const addAction = () => {
    const value = newAction.trim();
    if (!value) return;
    if (actionsTaken.includes(value)) return;
    onChange([...actionsTaken, value]);
    setNewAction('');
  };

  const updateAction = (index: number, value: string) => {
    const next = [...actionsTaken];
    next[index] = value;
    onChange(next.map((x) => x.trim()).filter(Boolean));
  };

  const deleteAction = (index: number) => {
    const next = actionsTaken.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [...DEFAULT_ACTIONS_TAKEN]);
  };

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Actions Taken
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Edit the action chips staff can select when logging an incident (e.g. &quot;Parents notified&quot;). At least
          one action is required; clearing the list restores defaults.
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="New action"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              fullWidth
            />
            <Button variant="contained" onClick={addAction}>
              Add
            </Button>
          </Box>
        </Card>

        <List disablePadding>
          {actionsTaken.map((item, idx) => (
            <ListItem key={`${item}-${idx}`} divider sx={{ gap: 1 }}>
              <ListItemText
                primary={
                  <TextField
                    label={`Action ${idx + 1}`}
                    value={item}
                    onChange={(e) => updateAction(idx, e.target.value)}
                    fullWidth
                  />
                }
              />
              <IconButton color="error" onClick={() => deleteAction(idx)} aria-label="Delete action">
                <DeleteIcon />
              </IconButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Container>
  );
}
