import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { PRESET_PATTERNS } from '../rhythms/RhythmPatterns';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

export interface GenreSelectorModalProps {
  open: boolean;
  onClose: () => void;
  selectedPatternId: string;
  queuedPatternId: string | null;
  isPlaying: boolean;
  onSelectPattern: (patternId: string) => void;
}

export const GenreSelectorModal: React.FC<GenreSelectorModalProps> = ({
  open,
  onClose,
  selectedPatternId,
  queuedPatternId,
  isPlaying,
  onSelectPattern
}) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#12100e',
          borderRadius: 4,
          border: '1px solid rgba(229,169,95,0.2)'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight="bold" color="primary.main">
            BIBLIOTECA VISUAL DE RITMOS
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Selecciona un patrón rítmico folclórico o moderno
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(215,204,200,0.08)' }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2,
          py: 1
        }}>
          {PRESET_PATTERNS.map((p: RhythmPattern) => {
            const isSelected = selectedPatternId === p.id;
            const isQueued = queuedPatternId === p.id;

            return (
              <Box
                key={p.id}
                onClick={() => {
                  onSelectPattern(p.id);
                  if (!isPlaying) onClose();
                }}
                sx={{
                  position: 'relative',
                  height: 180,
                  borderRadius: 3,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #e5a95f' : '1px solid rgba(215,204,200,0.1)',
                  boxShadow: isSelected ? '0 0 15px rgba(229,169,95,0.3)' : '0 4px 12px rgba(0,0,0,0.4)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: 'primary.main',
                    boxShadow: '0 8px 24px rgba(229,169,95,0.25)'
                  }
                }}
              >
                {/* Imagen de Portada de Fondo */}
                <Box
                  component="img"
                  src={p.coverImage || '/genres/genre_rock.webp'}
                  alt={p.name}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 0
                  }}
                />
                {/* Degradado oscuro */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(to top, rgba(12,11,10,0.95) 20%, rgba(12,11,10,0.4) 70%, rgba(12,11,10,0.1) 100%)',
                    zIndex: 1
                  }}
                />

                {/* Contenido de la Tarjeta */}
                <Box
                  sx={{
                    position: 'relative',
                    zIndex: 2,
                    p: 2,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Chip 
                      label={p.timeSignature ? `${p.timeSignature[0]}/${p.timeSignature[1]}` : '4/4'} 
                      size="small" 
                      sx={{ bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: '#e5a95f', fontWeight: 'bold' }}
                    />
                    {isQueued && (
                      <Chip label="EN COLA" size="small" color="secondary" sx={{ fontWeight: 'bold' }} />
                    )}
                    {isSelected && !isQueued && (
                      <Chip label="ACTIVO" size="small" color="primary" sx={{ fontWeight: 'bold' }} />
                    )}
                  </Box>

                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                      {p.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.description || 'Patrón rítmico profesional'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
