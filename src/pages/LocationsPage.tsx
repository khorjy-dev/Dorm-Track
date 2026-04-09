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

export default function LocationsPage(props: {
  locations: string[];
  onChange: (next: string[]) => void;
}) {
  const { locations, onChange } = props;
  const [newLocation, setNewLocation] = React.useState('');

  const addLocation = () => {
    const value = newLocation.trim();
    if (!value) return;
    if (locations.includes(value)) return;
    onChange([...locations, value]);
    setNewLocation('');
  };

  const updateLocation = (index: number, value: string) => {
    const next = [...locations];
    next[index] = value;
    onChange(next.map((x) => x.trim()).filter(Boolean));
  };

  const deleteLocation = (index: number) => {
    const next = locations.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : ['Student Room']);
  };

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Incident locations
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add or edit location options used when logging incidents.
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="New location"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              fullWidth
            />
            <Button variant="contained" onClick={addLocation}>
              Add
            </Button>
          </Box>
        </Card>

        <List disablePadding>
          {locations.map((item, idx) => (
            <ListItem key={`${item}-${idx}`} divider sx={{ gap: 1 }}>
              <ListItemText
                primary={
                  <TextField
                    label={`Location ${idx + 1}`}
                    value={item}
                    onChange={(e) => updateLocation(idx, e.target.value)}
                    fullWidth
                  />
                }
              />
              <IconButton color="error" onClick={() => deleteLocation(idx)} aria-label="Delete location">
                <DeleteIcon />
              </IconButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Container>
  );
}

