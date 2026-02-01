
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Cliente, Trabajo, Gasto, JobStatus, TallerInfo } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import Dashboard from './Dashboard';
import Trabajos from './Trabajos';
import Clientes from './Clientes';
import Ajustes from './Ajustes';
import Header from './Header';
import { ChartPieIcon, WrenchScrewdriverIcon, UsersIcon, Cog6ToothIcon } from '@heroicons/react/24/solid';
import { applyAppTheme, applyFontSize } from '../constants';

interface TallerDashboardProps {
    onLogout: () => void;
}

type View = 'dashboard' | 'trabajos' | 'clientes' | 'ajustes';

const VIEW_ORDER: View[] = ['dashboard', 'trabajos', 'clientes', 'ajustes'];

const navItems = [
    { id: 'dashboard', label: 'Resumen', icon: ChartPieIcon },
    { id: 'trabajos', label: 'Trabajos', icon: WrenchScrewdriverIcon },
    { id: 'clientes', label: 'Clientes', icon: UsersIcon },
    { id: 'ajustes', label: 'Ajustes', icon: Cog6ToothIcon },
] as const;

const TallerDashboard: React.FC<TallerDashboardProps> = ({ onLogout }) => {
    const [view, setView] = useState<View>('dashboard');
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [tallerInfo, setTallerInfo] = useState<TallerInfo>({
        nombre: 'Mi Taller',
        telefono: '',
        direccion: '',
        cuit: '',
        pdfTemplate: 'classic',
        showLogoOnPdf: false,
        showCuitOnPdf: true,
        logoUrl: undefined,
        headerColor: '#334155',
        fontSize: 'normal'
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [targetJobStatus, setTargetJobStatus] = useState<JobStatus | undefined>(undefined);
    const [targetJobId, setTargetJobId] = useState<string | undefined>(undefined);

    const fetchData = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: tallerInfoData } = await supabase.from('taller_info').select('*').eq('taller_id', user.id).maybeSingle();
            if (tallerInfoData) {
                const loadedInfo: TallerInfo = {
                    nombre: tallerInfoData.nombre || '',
                    telefono: tallerInfoData.telefono || '',
                    direccion: tallerInfoData.direccion || '',
                    cuit: tallerInfoData.cuit || '',
                    logoUrl: tallerInfoData.logo_url,
                    pdfTemplate: tallerInfoData.pdf_template || 'classic',
                    showLogoOnPdf: tallerInfoData.show_logo_on_pdf === true,
                    showCuitOnPdf: tallerInfoData.show_cuit_on_pdf !== false,
                    headerColor: tallerInfoData.header_color || '#334155',
                    fontSize: tallerInfoData.font_size || 'normal'
                };
                setTallerInfo(loadedInfo);
                applyAppTheme();
                if (loadedInfo.fontSize) applyFontSize(loadedInfo.fontSize);
            }

            const { data: clientesData } = await supabase.from('clientes').select('*, vehiculos(*)').eq('taller_id', user.id);
            if (clientesData) setClientes(clientesData as Cliente[]);

            const { data: trabajosData } = await supabase.from('trabajos').select('*').eq('taller_id', user.id);
            if (trabajosData) {
                 setTrabajos(trabajosData.map(t => ({
                    id: t.id,
                    tallerId: t.taller_id,
                    clienteId: t.cliente_id,
                    vehiculoId: t.vehiculo_id,
                    descripcion: t.descripcion,
                    partes: t.partes,
                    costoManoDeObra: t.costo_mano_de_obra,
                    costoEstimado: t.costo_estimado,
                    status: t.status,
                    fechaEntrada: t.fecha_entrada,
                    fechaSalida: t.fecha_salida,
                    fechaProgramada: t.fecha_programada,
                    kilometraje: t.kilometraje,
                    notaAdicional: t.nota_adicional,
                    isQuickBudget: t.is_quick_budget,
                    quickBudgetData: t.quick_budget_data,
                    expiresAt: t.expires_at
                })) as Trabajo[]);
            }

            const { data: gastosData } = await supabase.from('gastos').select('*').eq('taller_id', user.id).order('fecha', { ascending: false });
            if (gastosData) setGastos(gastosData);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    const handleNavigate = (newView: View, status?: JobStatusEnum, jobId?: string) => {
        setTargetJobStatus(status);
        setTargetJobId(jobId);
        setView(newView);
    };

    const handleUpdateStatus = async (trabajoId: string, newStatus: JobStatusEnum) => {
        try {
            const updates: any = { status: newStatus };
            if (newStatus === JobStatusEnum.Finalizado) updates.fecha_salida = new Date().toISOString();
            else updates.fecha_salida = null;
            await supabase.from('trabajos').update(updates).eq('id', trabajoId);
            fetchData(false);
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const activeIndex = VIEW_ORDER.indexOf(view);

    return (
        <div className="flex h-full w-full bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light overflow-hidden fixed inset-0">
            <style>{`
                /* Bloqueo total de scroll nativo para evitar saltos por enfoque */
                body, html, #root { overflow: hidden !important; position: fixed; width: 100%; height: 100%; }
                .main-view-slot { 
                    width: 25%; /* 100% / 4 vistas */
                    height: 100%; 
                    flex-shrink: 0;
                    overflow: hidden;
                    position: relative;
                }
            `}</style>

            {/* Sidebar Desktop */}
            <aside className="hidden md:flex md:flex-col w-64 bg-white dark:bg-gray-800 shadow-lg shrink-0 border-r dark:border-gray-700 z-[60]">
                <div className="h-20 flex items-center justify-center border-b dark:border-gray-700 p-4">
                    {tallerInfo.logoUrl ? <img src={tallerInfo.logoUrl} alt="Logo" className="max-h-full object-contain"/> : <WrenchScrewdriverIcon className="h-10 w-10 text-taller-primary" />}
                </div>
                <nav className="flex-1 px-4 py-6 space-y-2">
                    {navItems.map((item) => (
                        <button key={item.id} onClick={() => handleNavigate(item.id as View)} className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${view === item.id ? 'bg-taller-primary text-white shadow-md' : 'text-taller-gray dark:text-gray-400 hover:bg-taller-light dark:hover:bg-gray-700'}`}>
                            <item.icon className="h-6 w-6 mr-3" />
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Contenedor Principal */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                
                {/* Header (Fijo) */}
                <div className="flex-shrink-0 w-full z-[50] overflow-hidden bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                    <Header 
                        tallerName={tallerInfo.nombre} 
                        logoUrl={tallerInfo.logoUrl}
                        showMenuButton={false}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </div>
                
                {/* PAGER DE VISTAS PRINCIPALES */}
                <div className="flex-1 w-full overflow-hidden relative bg-taller-light dark:bg-taller-dark">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-taller-light dark:bg-taller-dark z-[40]">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-taller-primary"></div>
                        </div>
                    ) : (
                        <div 
                            className="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                            style={{ 
                                /* IMPORTANTE: Track del 400% con saltos del 25% */
                                width: '400%',
                                transform: `translate3d(-${activeIndex * 25}%, 0, 0)`
                            }}
                        >
                            {/* VISTA 1: RESUMEN */}
                            <div className="main-view-slot" style={{ pointerEvents: view === 'dashboard' ? 'auto' : 'none' }}>
                                <div className="h-full overflow-y-auto overscroll-none px-4 py-4 md:px-6 md:py-6">
                                    <div className="max-w-7xl mx-auto min-h-full pb-32">
                                        <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={() => fetchData(false)} searchQuery={searchQuery} onNavigate={handleNavigate} />
                                    </div>
                                </div>
                            </div>
                            
                            {/* VISTA 2: TRABAJOS */}
                            <div className="main-view-slot" style={{ pointerEvents: view === 'trabajos' ? 'auto' : 'none' }}>
                                <Trabajos 
                                    trabajos={trabajos} 
                                    clientes={clientes} 
                                    onUpdateStatus={handleUpdateStatus} 
                                    onDataRefresh={() => fetchData(false)} 
                                    tallerInfo={tallerInfo} 
                                    searchQuery={searchQuery} 
                                    initialTab={targetJobStatus} 
                                    initialJobId={targetJobId} 
                                    isActive={view === 'trabajos'} 
                                />
                            </div>

                            {/* VISTA 3: CLIENTES */}
                            <div className="main-view-slot" style={{ pointerEvents: view === 'clientes' ? 'auto' : 'none' }}>
                                <div className="h-full overflow-y-auto overscroll-none px-4 py-4 md:px-6 md:py-6">
                                    <div className="max-w-7xl mx-auto min-h-full pb-32">
                                        <Clientes clientes={clientes} trabajos={trabajos} onDataRefresh={() => fetchData(false)} searchQuery={searchQuery} onNavigate={handleNavigate} />
                                    </div>
                                </div>
                            </div>

                            {/* VISTA 4: AJUSTES */}
                            <div className="main-view-slot" style={{ pointerEvents: view === 'ajustes' ? 'auto' : 'none' }}>
                                <div className="h-full overflow-y-auto overscroll-none px-4 py-4 md:px-6 md:py-6">
                                    <div className="max-w-7xl mx-auto min-h-full pb-32">
                                        <Ajustes tallerInfo={tallerInfo} onUpdateTallerInfo={async (newInfo) => {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (user) await supabase.from('taller_info').upsert({ taller_id: user.id, ...newInfo, updated_at: new Date().toISOString() });
                                            setTallerInfo(newInfo);
                                            applyAppTheme();
                                        }} onLogout={onLogout} searchQuery={searchQuery} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navegación Móvil (Fija) */}
                <nav className="md:hidden bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex-shrink-0 z-[60] h-20 overflow-hidden relative">
                    <div className="flex justify-around items-center h-full w-full">
                        {navItems.map((item) => (
                            <button key={item.id} onClick={() => handleNavigate(item.id as View)} className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${view === item.id ? 'text-taller-primary' : 'text-taller-gray dark:text-gray-400'}`}>
                                <item.icon className="h-6 w-6" />
                                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                                {view === item.id && <span className="absolute top-0 w-8 h-1 bg-taller-primary rounded-b-lg"></span>}
                            </button>
                        ))}
                    </div>
                </nav>
            </div>
        </div>
    );
};

export default TallerDashboard;
