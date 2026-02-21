import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Thermometer, Box, Grid3x3, AlertCircle, Refrigerator } from 'lucide-react';

const ColdStorage = () => {
  const [chambers, setChambers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [temperatureLogs, setTemperatureLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChamber, setSelectedChamber] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [chambersRes, slotsRes, inventoryRes, tempLogsRes] = await Promise.all([
        axios.get(`${API}/cold-storage/chambers`),
        axios.get(`${API}/cold-storage/slots`),
        axios.get(`${API}/cold-storage/inventory`),
        axios.get(`${API}/cold-storage/temperature-logs`)
      ]);
      setChambers(chambersRes.data);
      setSlots(slotsRes.data);
      setInventory(inventoryRes.data);
      setTemperatureLogs(tempLogsRes.data);
      
      if (chambersRes.data.length > 0 && !selectedChamber) {
        setSelectedChamber(chambersRes.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load cold storage data');
    } finally {
      setLoading(false);
    }
  };

  const getSlotColor = (status) => {
    const colors = {
      empty: 'bg-gray-200 hover:bg-gray-300 text-gray-600',
      occupied: 'bg-blue-500 hover:bg-blue-600 text-white',
      reserved: 'bg-yellow-400 hover:bg-yellow-500 text-gray-800',
      maintenance: 'bg-red-400 hover:bg-red-500 text-white',
    };
    return colors[status] || colors.empty;
  };

  const getSlotIcon = (status) => {
    if (status === 'occupied' || status === 'reserved') {
      return <Box size={16} />;
    }
    return null;
  };

  const chamberSlots = selectedChamber
    ? slots.filter(slot => slot.chamber_id === selectedChamber)
    : [];

  // Group slots by rack number
  const slotsByRack = chamberSlots.reduce((acc, slot) => {
    if (!acc[slot.rack_number]) {
      acc[slot.rack_number] = [];
    }
    acc[slot.rack_number].push(slot);
    return acc;
  }, {});

  const currentChamber = chambers.find(c => c.id === selectedChamber);
  const currentTempLog = temperatureLogs.find(log => log.chamber_id === selectedChamber);

  // Calculate occupancy
  const totalSlots = chamberSlots.length;
  const occupiedSlots = chamberSlots.filter(s => s.status === 'occupied').length;
  const occupancyPercent = totalSlots > 0 ? ((occupiedSlots / totalSlots) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6" data-testid="cold-storage-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Cold Storage Management</h1>
          <p className="text-slate-600 mt-1">Visual slot mapping and inventory tracking</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chamber Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Chambers</p>
                    <p className="text-2xl font-bold text-slate-800">{chambers.length}</p>
                  </div>
                  <Refrigerator className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Slots</p>
                    <p className="text-2xl font-bold text-slate-800">{totalSlots}</p>
                  </div>
                  <Grid3x3 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Occupancy</p>
                    <p className="text-2xl font-bold text-slate-800">{occupancyPercent}%</p>
                  </div>
                  <Box className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Temperature</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {currentTempLog ? `${currentTempLog.temperature_c}C` : 'N/A'}
                    </p>
                  </div>
                  <Thermometer className="h-8 w-8 text-cyan-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chamber Selection and Visual Map */}
          <Card>
            <CardHeader>
              <CardTitle>Chamber Visual Map</CardTitle>
              <div className="flex gap-2 mt-4">
                {chambers.map(chamber => (
                  <Button
                    key={chamber.id}
                    variant={selectedChamber === chamber.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedChamber(chamber.id)}
                  >
                    {chamber.chamber_code}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {currentChamber && (
                <div className="space-y-4">
                  <div className="bg-slate-100 p-4 rounded-lg">
                    <h3 className="font-semibold text-slate-800 mb-2">{currentChamber.chamber_name}</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">Code:</span>
                        <span className="ml-2 font-medium">{currentChamber.chamber_code}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Capacity:</span>
                        <span className="ml-2 font-medium">{currentChamber.capacity_kg} KG</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Setpoint:</span>
                        <span className="ml-2 font-medium">{currentChamber.setpoint_temperature_c}C</span>
                      </div>
                    </div>
                  </div>

                  {/* Slot Map Legend */}
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-200 border border-gray-300"></div>
                      <span>Empty</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 border border-blue-600"></div>
                      <span>Occupied</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-400 border border-yellow-500"></div>
                      <span>Reserved</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-400 border border-red-500"></div>
                      <span>Maintenance</span>
                    </div>
                  </div>

                  {/* Slot Grid by Racks */}
                  {totalSlots > 0 ? (
                    <div className="space-y-6">
                      {Object.keys(slotsByRack).sort((a, b) => Number(a) - Number(b)).map(rackNumber => (
                        <div key={rackNumber} className="border border-slate-200 rounded-lg p-4">
                          <h4 className="font-semibold text-slate-700 mb-3">Rack {rackNumber}</h4>
                          <div className="grid grid-cols-8 gap-2">
                            {slotsByRack[rackNumber]
                              .sort((a, b) => a.slot_number - b.slot_number)
                              .map(slot => (
                                <button
                                  key={slot.id}
                                  className={`aspect-square rounded-lg border-2 transition-all duration-200 flex items-center justify-center text-xs font-medium ${getSlotColor(slot.status)}`}
                                  title={`Slot ${slot.slot_number} - ${slot.status}`}
                                >
                                  <div className="flex flex-col items-center">
                                    {getSlotIcon(slot.status)}
                                    <span className="mt-1">S{slot.slot_number}</span>
                                  </div>
                                </button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Grid3x3 className="h-12 w-12 text-slate-300 mb-4" />
                      <p className="text-slate-500">No slots configured for this chamber</p>
                    </div>
                  )}
                </div>
              )}

              {chambers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Refrigerator className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">No cold storage chambers configured yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory and Temperature Tabs */}
          <Tabs defaultValue="inventory" className="w-full">
            <TabsList>
              <TabsTrigger value="inventory">Inventory ({inventory.length})</TabsTrigger>
              <TabsTrigger value="temperature">Temperature Logs ({temperatureLogs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="inventory" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Current Inventory</CardTitle>
                </CardHeader>
                <CardContent>
                  {inventory.length > 0 ? (
                    <div className="space-y-3">
                      {inventory.map((item) => {
                        const slot = slots.find(s => s.id === item.slot_id);
                        return (
                          <div key={item.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-slate-800">Slot: {slot?.slot_code || 'N/A'}</p>
                                <p className="text-sm text-slate-600 mt-1">FG ID: {item.fg_id}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-slate-800">{item.quantity_kg} KG</p>
                                <p className="text-sm text-slate-600">{item.carton_count} cartons</p>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                              <span>Days in storage: {item.days_in_storage}</span>
                              {item.fifo_alert && (
                                <span className="flex items-center gap-1 text-orange-600 font-medium">
                                  <AlertCircle size={12} />
                                  FIFO Alert
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Box className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                      <p>No inventory in cold storage</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="temperature" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Temperature Monitoring</CardTitle>
                </CardHeader>
                <CardContent>
                  {temperatureLogs.length > 0 ? (
                    <div className="space-y-3">
                      {temperatureLogs.slice(0, 10).map((log) => {
                        const chamber = chambers.find(c => c.id === log.chamber_id);
                        return (
                          <div key={log.id} className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div>
                              <p className="font-medium text-slate-800">{chamber?.chamber_name || 'Unknown Chamber'}</p>
                              <p className="text-sm text-slate-500">{new Date(log.recorded_at).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xl font-bold ${log.alert ? 'text-red-600' : 'text-green-600'}`}>
                                {log.temperature_c}C
                              </p>
                              {log.alert && (
                                <p className="text-xs text-red-600 flex items-center gap-1 justify-end">
                                  <AlertCircle size={12} />
                                  {log.alert_reason}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Thermometer className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                      <p>No temperature logs available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default ColdStorage;
