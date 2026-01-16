
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';
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
    
    const mainContainerRef = useRef<HTMLElement>(null);
    const dashboardRef = useRef<HTMLDivElement>(null);
    const trabajosRef = useRef<HTMLDivElement>(null);
    const clientesRef = useRef<HTMLDivElement>(null);
    const ajustesRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async (showLoader = true) => {
        if (showLoader) {
            setLoading(true);
        }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

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
                    showLogoOnPdf: tallerInfoData.show_logo_on_pdf === true,
                    showCuitOnPdf: tallerInfoData.show_cuit_on_pdf !== false,
                    headerColor: tallerInfoData.header_color || '#334155',
                    fontSize: tallerInfoData.font_size || 'normal'
                };
                setTallerInfo(loadedInfo);
                
                applyAppTheme();
                if (loadedInfo.fontSize) applyFontSize(loadedInfo.fontSize);

            } else if (!tallerInfoData) {
                if (user.user_metadata?.taller_info) {
                    setTallerInfo(prev => ({ ...prev, ...user.user_metadata.taller_info }));
                }
            }

            const { data: clientesData, error: clientesError } = await supabase
                .from('clientes')
                .select('*, vehiculos(*)')
                .eq('taller_id', user.id);
            
            if (clientesError) throw clientesError;
            if (clientesData) setClientes(clientesData as Cliente[]);

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
                    notaAdicional: t.nota_adicional,
                    isQuickBudget: t.is_quick_budget,
                    quickBudgetData: t.quick_budget_data,
                    expiresAt: t.expires_at
                }));
                setTrabajos(mappedTrabajos as Trabajo[]);
            }

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
        setSearchQuery('');
        
        // Función para resetear el scroll de manera robusta
        const resetScroll = () => {
            // Aseguramos el scroll del viewport global
            window.scrollTo(0, 0);

            // CORRECCIÓN CRÍTICA: Resetear el scroll del contenedor principal (main)
            // Esto evita que el navegador desplace el layout horizontalmente al hacer focus o scrollIntoView
            if (mainContainerRef.current) {
                mainContainerRef.current.scrollTop = 0;
                mainContainerRef.current.scrollLeft = 0;
            }

            if (view === 'trabajos') {
                const internalContainer = document.getElementById('trabajos-scroll-container');
                if (internalContainer) {
                    internalContainer.scrollTop = 0;
                }
            } else {
                const activeRef = 
                    view === 'dashboard' ? dashboardRef :
                    view === 'clientes' ? clientesRef :
                    view === 'ajustes' ? ajustesRef :
                    null;
                    
                if (activeRef && activeRef.current) {
                    activeRef.current.scrollTop = 0;
                }
            }
        };

        // Ejecutar inmediatamente
        resetScroll();

        // Ejecutar nuevamente tras un breve delay para asegurar que el layout se ha estabilizado
        const timer = setTimeout(resetScroll, 100);
        return () => clearTimeout(timer);

    }, [view]);
    
    const handleSilentRefresh = () => fetchData(false);

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
            const trabajoActual = trabajos.find(t => t.id === trabajoId);
            if (!trabajoActual) return;

            let fechaSalida: string | null | undefined = undefined;
            const updates: any = { status: newStatus };

            if (newStatus === JobStatusEnum.Finalizado) {
                fechaSalida = new Date().toISOString();
                updates.fecha_salida = fechaSalida;
            } else {
                fechaSalida = null;
                updates.fecha_salida = null;
            }

            // LÓGICA DE CONVERSIÓN: Si es presupuesto rápido y pasa a otro estado
            if (trabajoActual.isQuickBudget && newStatus !== JobStatusEnum.Presupuesto && trabajoActual.quickBudgetData) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // 1. Crear usuario en Auth y Tabla Clientes
                const tempPassword = Math.random().toString(36).slice(-8) + '!Aa1';
                const signUpEmail = `${crypto.randomUUID()}@taller-quick.com`;

                const tempSupabase = createClient(supabaseUrl, supabaseKey, {
                    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
                });

                const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
                    email: signUpEmail,
                    password: tempPassword,
                    options: {
                        data: {
                            role: 'cliente',
                            taller_nombre_ref: tallerInfo.nombre,
                        },
                    }
                });

                if (signUpError) throw signUpError;
                const newUserId = signUpData.user!.id;

                // Guardar pass temporal
                localStorage.setItem(`temp_pass_${newUserId}`, tempPassword);

                // Insertar Perfil Cliente
                const { error: clientError } = await supabase.from('clientes').insert({
                    id: newUserId,
                    taller_id: user.id,
                    nombre: trabajoActual.quickBudgetData.nombre,
                    apellido: trabajoActual.quickBudgetData.apellido || '',
                    email: '',
                    telefono: ''
                });

                if (clientError) throw clientError;

                // 2. Crear Vehículo
                const { data: newVeh, error: vehError } = await supabase.from('vehiculos').insert({
                    cliente_id: newUserId,
                    marca: trabajoActual.quickBudgetData.marca,
                    modelo: trabajoActual.quickBudgetData.modelo,
                    matricula: trabajoActual.quickBudgetData.matricula || ''
                }).select().single();

                if (vehError) throw vehError;

                // 3. Vincular el trabajo al nuevo cliente y vehículo, y quitar flag de quickBudget
                updates.cliente_id = newUserId;
                updates.vehiculo_id = newVeh.id;
                updates.is_quick_budget = false;
                updates.quick_budget_data = null;
            }

            const { error } = await supabase
                .from('trabajos')
                .update(updates)
                .eq('id', trabajoId);
            
            if (error) throw error;
            
            // Refrescar datos para que desaparezca el aviso de "Presupuesto Rápido"
            fetchData(false);
            
        } catch (error: any) {
            console.error("Error updating status:", error);
            alert("Error al actualizar: " + error.message);
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
                 show_logo_on_pdf: newInfo.showLogoOnPdf,
                 show_cuit_on_pdf: newInfo.showCuitOnPdf,
                 header_color: newInfo.headerColor,
                 font_size: newInfo.fontSize,
                 updated_at: new Date().toISOString()
             });

             if (dbError) throw dbError;

             await supabase.auth.updateUser({
                 data: { taller_info: newInfo }
             });

             setTallerInfo(newInfo);
             applyAppTheme();
             if (newInfo.fontSize) applyFontSize(newInfo.fontSize);

        } catch (error: any) {
            console.error("Error updating taller info:", error);
            alert(`Error al guardar configuración: ${error.message || 'Error desconocido'}.`);
            throw error;
        }
    };

    const handleNavigate = (newView: View, status?: JobStatus, jobId?: string) => {
        setView(newView);
        if (status) {
            setTargetJobStatus(status);
        }
        if (jobId) {
            setTargetJobId(jobId);
        }
    };

    const sidebarClasses = `hidden md:flex md:flex-col fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-lg md:static md:inset-0`;
    
    const activeIndex = VIEW_ORDER.indexOf(view);
    const translateValue = `-${activeIndex * 100}%`;

    return (
        <div className="flex h-full bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light overflow-hidden transition-colors duration-300">
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
                                    if (item.id === 'trabajos') {
                                        setTargetJobStatus(undefined);
                                        setTargetJobId(undefined);
                                    }
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

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <Header 
                    tallerName={tallerInfo.nombre} 
                    logoUrl={tallerInfo.logoUrl}
                    showMenuButton={false}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />
                
                <main ref={mainContainerRef} className="flex-1 overflow-hidden relative w-full min-h-0">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-taller-primary"></div>
                        </div>
                    ) : (
                        <div 
                            className="flex h-full w-full transition-transform duration-300 ease-out will-change-transform"
                            style={{ transform: `translateX(${translateValue})` }}
                        >
                            <div ref={dashboardRef} className="w-full h-full flex-shrink-0 overflow-y-auto p-4 md:p-6 scroll-smooth overscroll-contain">
                                <div className="max-w-7xl mx-auto min-h-full">
                                    <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={handleSilentRefresh} searchQuery={searchQuery} onNavigate={handleNavigate} />
                                </div>
                            </div>

                            <div ref={trabajosRef} className="w-full h-full flex-shrink-0 overflow-hidden p-0 md:p-6 bg-taller-light dark:bg-taller-dark">
                                <div className="w-full h-full">
                                    <Trabajos 
                                        trabajos={trabajos} 
                                        clientes={clientes} 
                                        onUpdateStatus={handleUpdateStatus} 
                                        onDataRefresh={handleSilentRefresh} 
                                        tallerInfo={tallerInfo} 
                                        searchQuery={searchQuery} 
                                        initialTab={targetJobStatus}
                                        initialJobId={targetJobId}
                                        isActive={view === 'trabajos'}
                                    />
                                </div>
                            </div>

                            <div ref={clientesRef} className="w-full h-full flex-shrink-0 overflow-y-auto p-4 md:p-6 scroll-smooth overscroll-contain">
                                <div className="max-w-7xl mx-auto min-h-full">
                                    <Clientes clientes={clientes} trabajos={trabajos} onDataRefresh={handleSilentRefresh} searchQuery={searchQuery} onClientUpdate={handleClientUpdate} />
                                </div>
                            </div>

                            <div ref={ajustesRef} className="w-full h-full flex-shrink-0 overflow-y-auto p-4 md:p-6 scroll-smooth overscroll-contain">
                                <div className="max-w-7xl mx-auto min-h-full">
                                    <Ajustes tallerInfo={tallerInfo} onUpdateTallerInfo={handleUpdateTallerInfo} onLogout={onLogout} searchQuery={searchQuery} />
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                <div className="md:hidden bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-5 flex-shrink-0 z-20">
                        <nav className="flex justify-around items-center h-16">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setView(item.id as View);
                                    if (item.id === 'trabajos') {
                                        setTargetJobStatus(undefined);
                                        setTargetJobId(undefined);
                                    }
                                }}
                                className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
                                    view === item.id ? 'text-taller-primary' : 'text-taller-gray dark:text-gray-400'
                                }`}
                            >
                                <item.icon className="h-6 w-6" />
                                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                                {view === item.id && (
                                    <span className="absolute top-0 w-8 h-1 bg-taller-primary rounded-b-lg"></span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>
        </div>
    );
};

export default TallerDashboard;
