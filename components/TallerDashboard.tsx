
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Cliente, Trabajo, Gasto, JobStatus, TallerInfo } from '../types';
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

const navItems = [
    { id: 'dashboard', label: 'Resumen', icon: ChartPieIcon },
    { id: 'trabajos', label: 'Trabajos', icon: WrenchScrewdriverIcon },
    { id: 'clientes', label: 'Clientes', icon: UsersIcon },
    { id: 'ajustes', label: 'Ajustes', icon: Cog6ToothIcon },
] as const;

const TallerDashboard: React.FC<TallerDashboardProps> = ({ onLogout }) => {
    // Default always to 'dashboard' on mount, ignoring localStorage
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
        mobileNavStyle: 'bottom_nav',
        showLogoOnPdf: false,
        showCuitOnPdf: true,
        logoUrl: undefined,
        headerColor: '#334155',
        appTheme: 'slate',
        fontSize: 'normal'
    });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [targetJobStatus, setTargetJobStatus] = useState<JobStatus | undefined>(undefined);

    const fetchData = useCallback(async (showLoader = true) => {
        if (showLoader) {
            setLoading(true);
        }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Taller Info
            const { data: tallerInfoData, error: tallerInfoError } = await supabase
                .from('taller_info')
                .select('*')
                .eq('taller_id', user.id)
                .maybeSingle();

            if (!tallerInfoError && tallerInfoData) {
                const loadedInfo: TallerInfo = {
                    nombre: tallerInfoData.nombre || '',
                    telefono: tallerInfoData.telefono || '',
                    direccion: tallerInfoData.direccion || '',
                    cuit: tallerInfoData.cuit || '',
                    logoUrl: tallerInfoData.logo_url,
                    pdfTemplate: tallerInfoData.pdf_template || 'classic',
                    mobileNavStyle: tallerInfoData.mobile_nav_style || 'bottom_nav',
                    showLogoOnPdf: tallerInfoData.show_logo_on_pdf === true,
                    showCuitOnPdf: tallerInfoData.show_cuit_on_pdf !== false,
                    headerColor: tallerInfoData.header_color || '#334155',
                    appTheme: tallerInfoData.app_theme || 'slate',
                    fontSize: tallerInfoData.font_size || 'normal'
                };
                setTallerInfo(loadedInfo);
                
                if (loadedInfo.appTheme) applyAppTheme(loadedInfo.appTheme);
                if (loadedInfo.fontSize) applyFontSize(loadedInfo.fontSize);

            } else if (!tallerInfoData) {
                if (user.user_metadata?.taller_info) {
                    setTallerInfo(prev => ({ ...prev, ...user.user_metadata.taller_info }));
                }
            }

            // Fetch Clientes
            const { data: clientesData, error: clientesError } = await supabase
                .from('clientes')
                .select('*, vehiculos(*)')
                .eq('taller_id', user.id);
            
            if (clientesError) throw clientesError;
            if (clientesData) setClientes(clientesData as Cliente[]);

            // Fetch Trabajos
            const { data: trabajosData, error: trabajosError } = await supabase
                .from('trabajos')
                .select('*')
                .eq('taller_id', user.id);

            if (trabajosError) throw trabajosError;
            
            if (trabajosData) {
                 const mappedTrabajos = trabajosData.map(t => ({
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
                    notaAdicional: t.nota_adicional
                }));
                setTrabajos(mappedTrabajos as Trabajo[]);
            }

            // Fetch Gastos
            const { data: gastosData, error: gastosError } = await supabase
                .from('gastos')
                .select('*')
                .eq('taller_id', user.id)
                .order('fecha', { ascending: false });

            if (gastosError) throw gastosError;
            if (gastosData) setGastos(gastosData);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    useEffect(() => {
        setIsMobileMenuOpen(false);
        setSearchQuery('');
    }, [view]);
    
    const handleSilentRefresh = () => fetchData(false);

    // Optimistic Client Update
    const handleClientUpdate = (newClient: Cliente) => {
        setClientes(prev => {
            const exists = prev.find(c => c.id === newClient.id);
            if (exists) {
                return prev.map(c => c.id === newClient.id ? newClient : c);
            }
            return [...prev, newClient];
        });
    };

    const handleUpdateStatus = async (trabajoId: string, newStatus: JobStatus) => {
        try {
            const { error } = await supabase
                .from('trabajos')
                .update({ status: newStatus })
                .eq('id', trabajoId);
            
            if (error) throw error;
            
            setTrabajos(prev => prev.map(t => 
                t.id === trabajoId ? { ...t, status: newStatus } : t
            ));
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const handleUpdateTallerInfo = async (newInfo: TallerInfo) => {
        try {
             const { data: { user } } = await supabase.auth.getUser();
             if (!user) return;

             const { error: dbError } = await supabase.from('taller_info').upsert({
                 taller_id: user.id,
                 nombre: newInfo.nombre,
                 telefono: newInfo.telefono,
                 direccion: newInfo.direccion,
                 cuit: newInfo.cuit,
                 logo_url: newInfo.logoUrl,
                 pdf_template: newInfo.pdfTemplate,
                 mobile_nav_style: newInfo.mobileNavStyle,
                 show_logo_on_pdf: newInfo.showLogoOnPdf,
                 show_cuit_on_pdf: newInfo.showCuitOnPdf,
                 header_color: newInfo.headerColor,
                 app_theme: newInfo.appTheme,
                 font_size: newInfo.fontSize,
                 updated_at: new Date().toISOString()
             });

             if (dbError) throw dbError;

             await supabase.auth.updateUser({
                 data: { taller_info: newInfo }
             });

             setTallerInfo(newInfo);
             if (newInfo.appTheme) applyAppTheme(newInfo.appTheme);
             if (newInfo.fontSize) applyFontSize(newInfo.fontSize);

        } catch (error: any) {
            console.error("Error updating taller info:", error);
            alert(`Error al guardar configuración: ${error.message || 'Error desconocido'}.`);
            throw error;
        }
    };

    const handleNavigate = (newView: View, status?: JobStatus) => {
        setView(newView);
        if (status) {
            setTargetJobStatus(status);
        }
    };

    const renderContent = () => {
        switch (view) {
            case 'dashboard':
                return <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={handleSilentRefresh} searchQuery={searchQuery} onNavigate={handleNavigate} />;
            case 'trabajos':
                return <Trabajos trabajos={trabajos} clientes={clientes} onUpdateStatus={handleUpdateStatus} onDataRefresh={handleSilentRefresh} tallerInfo={tallerInfo} searchQuery={searchQuery} initialTab={targetJobStatus} />;
            case 'clientes':
                return <Clientes clientes={clientes} trabajos={trabajos} onDataRefresh={handleSilentRefresh} searchQuery={searchQuery} onClientUpdate={handleClientUpdate} />;
            case 'ajustes':
                return <Ajustes tallerInfo={tallerInfo} onUpdateTallerInfo={handleUpdateTallerInfo} onLogout={onLogout} searchQuery={searchQuery} />;
            default:
                return <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={handleSilentRefresh} searchQuery={searchQuery} onNavigate={handleNavigate} />;
        }
    };

    const sidebarClasses = `fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out shadow-lg md:translate-x-0 md:static md:inset-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`;

    return (
        <div className="flex h-[100dvh] bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light overflow-hidden transition-colors duration-300">
            <aside className={sidebarClasses}>
                <div className="h-full flex flex-col">
                    <div className="h-20 flex items-center justify-center border-b dark:border-gray-700">
                         {tallerInfo.logoUrl ? (
                            <img src={tallerInfo.logoUrl} alt="Logo" className="h-12 object-contain"/>
                        ) : (
                            <WrenchScrewdriverIcon className="h-10 w-10 text-taller-primary" />
                        )}
                    </div>
                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setView(item.id as View);
                                    if (item.id === 'trabajos') setTargetJobStatus(undefined);
                                }}
                                className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                                    view === item.id
                                        ? 'bg-taller-primary text-white shadow-md'
                                        : 'text-taller-gray dark:text-gray-400 hover:bg-taller-light dark:hover:bg-gray-700'
                                }`}
                            >
                                <item.icon className="h-6 w-6 mr-3" />
                                <span className="font-medium">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="p-4 border-t dark:border-gray-700">
                         <div className="text-xs text-center text-taller-gray dark:text-gray-500">
                            &copy; {new Date().getFullYear()} Gestor Taller
                        </div>
                    </div>
                </div>
            </aside>

            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header 
                    tallerName={tallerInfo.nombre} 
                    logoUrl={tallerInfo.logoUrl}
                    onMenuClick={() => setIsMobileMenuOpen(true)} 
                    showMenuButton={tallerInfo.mobileNavStyle === 'sidebar'}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />
                
                <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth overscroll-contain">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-taller-primary"></div>
                        </div>
                    ) : (
                        renderContent()
                    )}
                </main>

                {tallerInfo.mobileNavStyle === 'bottom_nav' && (
                    <div className="md:hidden bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-5 flex-shrink-0">
                         <nav className="flex justify-around items-center h-16">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setView(item.id as View);
                                        if (item.id === 'trabajos') setTargetJobStatus(undefined);
                                    }}
                                    className={`flex flex-col items-center justify-center w-full h-full ${
                                        view === item.id ? 'text-taller-primary' : 'text-taller-gray dark:text-gray-400'
                                    }`}
                                >
                                    <item.icon className="h-6 w-6" />
                                    <span className="text-[10px] mt-1">{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TallerDashboard;
