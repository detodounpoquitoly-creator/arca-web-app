'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const SCRIPT_ID = '1AhkP8dUA-6thvwC1CHIOo3wFM4m5NzLlPihTVYaD3N1LZBwVFurUHa76';
const SCRIPT_URL = `https://script.google.com/macros/d/${SCRIPT_ID}/usercopy`;

type Tab = 'emitir' | 'pasarelas' | 'historial' | 'pdfs';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('emitir');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Cargar tema guardado
  useEffect(() => {
    const saved = localStorage.getItem('arca-theme');
    if (saved) setTheme(saved as 'light' | 'dark');
  }, []);

  // Alternar tema
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('arca-theme', newTheme);
  };

  // Cargar datos del script
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${SCRIPT_URL}?action=getHistorial`);
      setData(res.data);
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const bgColor = theme === 'light' ? '#ffffff' : '#1f2937';
  const fgColor = theme === 'light' ? '#000000' : '#ffffff';
  const borderColor = theme === 'light' ? '#e5e7eb' : '#374151';
  const cardBg = theme === 'light' ? '#f9fafb' : '#111827';

  return (
    <div style={{ background: bgColor, color: fgColor, minHeight: '100vh', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${borderColor}`, paddingBlock: '24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700 }}>ARCA Control</h1>
          <p style={{ margin: '8px 0 0', color: theme === 'light' ? '#6b7280' : '#9ca3af', fontSize: '14px' }}>
            Gestión centralizada de facturación electrónica
          </p>
        </div>
        <button
          onClick={toggleTheme}
          style={{
            padding: '8px 16px',
            border: `1px solid ${borderColor}`,
            background: cardBg,
            color: fgColor,
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
          }}
        >
          {theme === 'light' ? '🌓 Modo oscuro' : '☀️ Modo claro'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: `1px solid ${borderColor}`, overflowX: 'auto' }}>
        {(['emitir', 'pasarelas', 'historial', 'pdfs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '16px 24px',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab ? '#2563eb' : (theme === 'light' ? '#6b7280' : '#9ca3af'),
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px',
              borderBottom: activeTab === tab ? '2px solid #2563eb' : 'transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px' }}>
        {activeTab === 'emitir' && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Facturación Manual</h2>
            <p style={{ color: theme === 'light' ? '#6b7280' : '#9ca3af', marginBottom: '24px', fontSize: '14px' }}>
              Selecciona el tipo de comprobante a emitir
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {['Factura A', 'Factura B', 'NC A', 'NC B', 'ND A', 'ND B'].map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => alert(`Abre formulario ${tipo}`)}
                  style={{
                    padding: '16px',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    background: cardBg,
                    color: fgColor,
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.color = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = borderColor;
                    e.currentTarget.style.color = fgColor;
                  }}
                >
                  {tipo}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'pasarelas' && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Facturación por Pasarelas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {['Clover (CSV)', 'Mercado Pago', 'GetNet'].map((pasarela) => (
                <button
                  key={pasarela}
                  onClick={() => alert(`Carga ${pasarela}`)}
                  style={{
                    padding: '16px',
                    border: '1px solid #2563eb',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  {pasarela}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'historial' && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Historial de Comprobantes</h2>
            {loading ? <p>Cargando...</p> : <p style={{ color: theme === 'light' ? '#6b7280' : '#9ca3af' }}>Sin datos aún</p>}
          </div>
        )}

        {activeTab === 'pdfs' && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Generar PDFs bajo Demanda</h2>
            <p style={{ color: theme === 'light' ? '#6b7280' : '#9ca3af' }}>
              Los comprobantes se respaldaron en el sistema. Genera PDFs solo cuando sea necesario.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
