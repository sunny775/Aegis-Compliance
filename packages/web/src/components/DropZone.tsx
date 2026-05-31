import { useRef, useState, type DragEvent } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  selectedName?: string;
}

/** Drag-and-drop PDF target with hover/active affordances. */
export function DropZone({ onFile, disabled, selectedName }: DropZoneProps) {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <Box
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      sx={{
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'center',
        px: 3,
        py: 6,
        borderRadius: 4,
        border: `1.5px dashed ${dragging ? theme.palette.primary.main : theme.palette.divider}`,
        backgroundColor: dragging
          ? alpha(theme.palette.primary.main, 0.06)
          : alpha(theme.palette.text.primary, 0.012),
        transition: 'all 160ms ease',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <Box sx={{ color: dragging ? 'primary.main' : 'text.disabled', mb: 1, '& svg': { fontSize: 44 } }}>
        <UploadFileRoundedIcon />
      </Box>
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        {selectedName ?? 'Drop a PDF here'}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2.5 }}>
        {selectedName ? 'Ready to ingest.' : 'or browse from your computer · PDF up to 30 MB'}
      </Typography>
      <Button variant="outlined" size="small" disabled={disabled}>
        Choose file
      </Button>
    </Box>
  );
}
