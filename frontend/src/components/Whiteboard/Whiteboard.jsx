// Collaborative canvas powered by Fabric.js.
// Every local change is broadcast via socket; remote changes are applied
// by reloading Fabric's JSON state.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Toolbar, Tooltip, IconButton, Divider, Slider, Typography, ButtonGroup, Button } from '@mui/material';
import {
  Create as PenIcon,
  PanTool as SelectIcon,
  RadioButtonUnchecked as CircleIcon,
  CropSquare as RectIcon,
  HorizontalRule as LineIcon,
  DeleteSweep as ClearIcon,
  Download as DownloadIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';
import { useSocket } from '../../hooks/useSocket';
import { documentsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#ffffff'];

export default function Whiteboard({ documentId, initialJson }) {
  const canvasRef    = useRef(null);
  const fabricRef    = useRef(null);     // fabric.Canvas instance
  const socket       = useSocket();
  const isRemoteRef  = useRef(false);    // prevent echo
  const historyRef   = useRef([]);       // undo stack

  const [tool, setTool]     = useState('pen');
  const [color, setColor]   = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [ready, setReady]   = useState(false);

  // ------------------------------------------------------------------
  // Initialise Fabric.js canvas
  // ------------------------------------------------------------------
  useEffect(() => {
    // Dynamic import so Fabric doesn't break SSR / Vite tree-shaking
    import('fabric').then(({ fabric }) => {
      if (!canvasRef.current || fabricRef.current) return;

      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        width:  canvasRef.current.parentElement?.clientWidth  || 800,
        height: canvasRef.current.parentElement?.clientHeight || 600,
        backgroundColor: '#ffffff',
      });

      fabricRef.current = canvas;

      // Load initial whiteboard JSON from DB
      if (initialJson) {
        try {
          canvas.loadFromJSON(JSON.parse(initialJson), canvas.renderAll.bind(canvas));
        } catch { /* ignore bad JSON */ }
      }

      // Free-draw brush defaults
      canvas.freeDrawingBrush.color = '#000000';
      canvas.freeDrawingBrush.width = 4;

      // Emit changes after each stroke / object modification
      const emitChange = () => {
        if (isRemoteRef.current) return;
        const json = canvas.toJSON();
        socket?.emit('whiteboard:draw', { documentId, fabricJson: json });
        // Push to undo stack
        historyRef.current.push(JSON.stringify(json));
        if (historyRef.current.length > 50) historyRef.current.shift();
      };

      canvas.on('path:created',          emitChange);
      canvas.on('object:modified',       emitChange);
      canvas.on('object:added',          emitChange);
      canvas.on('object:removed',        emitChange);

      setReady(true);

      // Resize handler
      const onResize = () => {
        const parent = canvasRef.current?.parentElement;
        if (!parent) return;
        canvas.setWidth(parent.clientWidth);
        canvas.setHeight(parent.clientHeight);
        canvas.renderAll();
      };
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('resize', onResize);
        canvas.dispose();
        fabricRef.current = null;
      };
    });
  }, []); // eslint-disable-line

  // ------------------------------------------------------------------
  // Receive remote whiteboard updates
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!socket || !fabricRef.current) return;

    const onDraw = ({ fabricJson }) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      isRemoteRef.current = true;
      canvas.loadFromJSON(fabricJson, () => {
        canvas.renderAll();
        isRemoteRef.current = false;
      });
    };

    const onClear = () => {
      fabricRef.current?.clear();
      fabricRef.current?.setBackgroundColor('#ffffff', fabricRef.current.renderAll.bind(fabricRef.current));
    };

    socket.on('whiteboard:draw',  onDraw);
    socket.on('whiteboard:clear', onClear);
    return () => {
      socket.off('whiteboard:draw', onDraw);
      socket.off('whiteboard:clear', onClear);
    };
  }, [socket]);

  // ------------------------------------------------------------------
  // Tool switching
  // ------------------------------------------------------------------
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    import('fabric').then(({ fabric }) => {
      if (tool === 'pen') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.width = brushSize;
      } else if (tool === 'select') {
        canvas.isDrawingMode = false;
        canvas.selection = true;
      } else {
        canvas.isDrawingMode = false;
        canvas.selection = false;
      }
    });
  }, [tool, color, brushSize]);

  // Update brush color/size live
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas?.freeDrawingBrush) return;
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = brushSize;
  }, [color, brushSize]);

  // ------------------------------------------------------------------
  // Add shapes on click (when a shape tool is active)
  // ------------------------------------------------------------------
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const onMouseDown = (opt) => {
      if (['pen', 'select'].includes(tool)) return;
      const pointer = canvas.getPointer(opt.e);

      import('fabric').then(({ fabric }) => {
        let obj;
        if (tool === 'rect') {
          obj = new fabric.Rect({ left: pointer.x, top: pointer.y, width: 100, height: 60, fill: 'transparent', stroke: color, strokeWidth: brushSize });
        } else if (tool === 'circle') {
          obj = new fabric.Circle({ left: pointer.x, top: pointer.y, radius: 40, fill: 'transparent', stroke: color, strokeWidth: brushSize });
        } else if (tool === 'line') {
          obj = new fabric.Line([pointer.x, pointer.y, pointer.x + 120, pointer.y], { stroke: color, strokeWidth: brushSize });
        }
        if (obj) canvas.add(obj);
      });
    };

    canvas.on('mouse:down', onMouseDown);
    return () => canvas.off('mouse:down', onMouseDown);
  }, [tool, color, brushSize]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  const handleClear = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
    socket?.emit('whiteboard:clear', { documentId });
    toast('Whiteboard cleared', { icon: '🗑️' });
  }, [socket, documentId]);

  const handleUndo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || historyRef.current.length < 2) return;
    historyRef.current.pop(); // remove current
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev) return;
    isRemoteRef.current = true;
    canvas.loadFromJSON(JSON.parse(prev), () => {
      canvas.renderAll();
      isRemoteRef.current = false;
    });
  }, []);

  const handleDownload = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
    const link = document.createElement('a');
    link.download = `whiteboard-${documentId}.png`;
    link.href = dataUrl;
    link.click();
  }, [documentId]);

  const handleSave = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      await documentsAPI.update(documentId, {
        whiteboardJson: JSON.stringify(canvas.toJSON()),
      });
      toast.success('Whiteboard saved!');
    } catch { toast.error('Save failed.'); }
  }, [documentId]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#f0f0f0', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 0.75,
          bgcolor: 'background.paper',
          borderBottom: '1px solid', borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        {/* Tools */}
        <ButtonGroup size="small" variant="outlined">
          {[
            { t: 'select', icon: <SelectIcon fontSize="small" />, label: 'Select' },
            { t: 'pen',    icon: <PenIcon fontSize="small" />,    label: 'Pen' },
            { t: 'rect',   icon: <RectIcon fontSize="small" />,   label: 'Rectangle' },
            { t: 'circle', icon: <CircleIcon fontSize="small" />, label: 'Circle' },
            { t: 'line',   icon: <LineIcon fontSize="small" />,   label: 'Line' },
          ].map(({ t, icon, label }) => (
            <Tooltip title={label} key={t}>
              <Button
                onClick={() => setTool(t)}
                variant={tool === t ? 'contained' : 'outlined'}
                sx={{ minWidth: 36, px: 0 }}
              >
                {icon}
              </Button>
            </Tooltip>
          ))}
        </ButtonGroup>

        <Divider orientation="vertical" flexItem />

        {/* Color palette */}
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {COLORS.map((c) => (
            <Box
              key={c}
              onClick={() => setColor(c)}
              sx={{
                width: 20, height: 20, borderRadius: '50%', bgcolor: c,
                border: color === c ? '2px solid #1a73e8' : '1.5px solid rgba(0,0,0,0.2)',
                cursor: 'pointer', flexShrink: 0,
                boxShadow: color === c ? '0 0 0 2px rgba(26,115,232,0.3)' : 'none',
              }}
            />
          ))}
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Brush size */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 120 }}>
          <Typography variant="caption" color="text.secondary" noWrap>Size</Typography>
          <Slider
            value={brushSize}
            onChange={(_, v) => setBrushSize(v)}
            min={1} max={30} size="small"
          />
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Actions */}
        <Tooltip title="Undo"><IconButton size="small" onClick={handleUndo}><UndoIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Clear canvas"><IconButton size="small" onClick={handleClear} color="error"><ClearIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Download PNG"><IconButton size="small" onClick={handleDownload}><DownloadIcon fontSize="small" /></IconButton></Tooltip>
        <Button size="small" variant="outlined" onClick={handleSave} sx={{ ml: 'auto' }}>Save</Button>
      </Box>

      {/* Canvas */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasRef} />
      </Box>
    </Box>
  );
}
