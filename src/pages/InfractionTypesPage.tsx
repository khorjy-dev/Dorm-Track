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

export default function InfractionTypesPage(props: {
  infractionTypes: string[];
  onChange: (next: string[]) => void;
}) {
  const { infractionTypes, onChange } = props;
  const [newType, setNewType] = React.useState('');

  const addType = () => {
    const value = newType.trim();
    if (!value) return;
    if (infractionTypes.includes(value)) return;
    onChange([...infractionTypes, value]);
    setNewType('');
  };

  const updateType = (index: number, value: string) => {
    const next = [...infractionTypes];
    next[index] = value;
    onChange(next.map((x) => x.trim()).filter(Boolean));
  };

  const deleteType = (index: number) => {
    const next = infractionTypes.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : ['Other']);
  };

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Infraction Types
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add or edit infraction categories used in incident logging.
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="New Infraction Type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              fullWidth
            />
            <Button variant="contained" onClick={addType}>
              Add
            </Button>
          </Box>
        </Card>

        <List disablePadding>
          {infractionTypes.map((item, idx) => (
            <ListItem key={`${item}-${idx}`} divider sx={{ gap: 1 }}>
              <ListItemText
                primary={
                  <TextField
                    label={`Type ${idx + 1}`}
                    value={item}
                    onChange={(e) => updateType(idx, e.target.value)}
                    fullWidth
                  />
                }
              />
              <IconButton color="error" onClick={() => deleteType(idx)} aria-label="Delete Type">
                <DeleteIcon />
              </IconButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Container>
  );
}

