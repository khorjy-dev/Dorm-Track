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

type EditableOptionListPageProps = {
  title: string;
  description: string;
  newItemLabel: string;
  itemLabelPrefix: string;
  deleteAriaLabel: string;
  items: string[];
  fallbackItems: string[];
  onChange: (next: string[]) => void;
};

export default function EditableOptionListPage(props: EditableOptionListPageProps) {
  const {
    title,
    description,
    newItemLabel,
    itemLabelPrefix,
    deleteAriaLabel,
    items,
    fallbackItems,
    onChange,
  } = props;
  const [newItem, setNewItem] = React.useState('');

  const addItem = () => {
    const value = newItem.trim();
    if (!value || items.includes(value)) return;
    onChange([...items, value]);
    setNewItem('');
  };

  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next.map((item) => item.trim()).filter(Boolean));
  };

  const deleteItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [...fallbackItems]);
  };

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label={newItemLabel} value={newItem} onChange={(e) => setNewItem(e.target.value)} fullWidth />
            <Button variant="contained" onClick={addItem}>
              Add
            </Button>
          </Box>
        </Card>

        <List disablePadding>
          {items.map((item, idx) => (
            <ListItem key={`${item}-${idx}`} divider sx={{ gap: 1 }}>
              <ListItemText
                primary={
                  <TextField
                    label={`${itemLabelPrefix} ${idx + 1}`}
                    value={item}
                    onChange={(e) => updateItem(idx, e.target.value)}
                    fullWidth
                  />
                }
              />
              <IconButton color="error" onClick={() => deleteItem(idx)} aria-label={deleteAriaLabel}>
                <DeleteIcon />
              </IconButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Container>
  );
}
