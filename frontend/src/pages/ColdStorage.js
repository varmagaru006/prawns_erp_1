import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Snowflake, Box, Thermometer, AlertTriangle, CheckCircle } from 'lucide-react';

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
      const [chambersRes, slotsRes, inventoryRes, templogsRes] = await Promise.all([
        axios.get(`${API}/cold-storage/chambers`),
        axios.get(`${API}/cold-storage/slots`),
        axios.get(`${API}/cold-storage/inventory`),
        axios.get(`${API}/cold-storage/temperature-logs`)
      ]);
      setChambers(chambersRes.data);
      setSlots(slotsRes.data);
      setInventory(inventoryRes.data);
      setTemperatureLogs(templogsRes.data);
      if (chambersRes.data.length > 0) {
        setSelectedChamber(chambersRes.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load cold storage data');
    } finally {
      setLoading(false);
    }
  };

  const getSlotStatusColor = (status) => {
    const colors = {
      empty: 'bg-slate-100 border-slate-300 hover:bg-slate-200',
      occupied: 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600',
      reserved: 'bg-yellow-500 border-yellow-600 text-white hover:bg-yellow-600',
      maintenance: 'bg-red-500 border-red-600 text-white hover:bg-red-600'
    };
    return colors[status] || colors.empty;
  };

  const SlotMap = ({ chamberId }) => {
    const chamberSlots = slots.filter(slot => slot.chamber_id === chamberId);
    const racks = {};
    
    chamberSlots.forEach(slot => {
      if (!racks[slot.rack_number]) {
        racks[slot.rack_number] = [];
      }
      racks[slot.rack_number].push(slot);
    });

    return (
      <div className=\"space-y-6\">
        {Object.keys(racks).length > 0 ? (
          Object.keys(racks).sort().map(rackNum => (
            <div key={rackNum} className=\"border rounded-lg p-4 bg-slate-50\">
              <h3 className=\"font-semibold mb-3 text-slate-700\">Rack {rackNum}</h3>
              <div className=\"grid grid-cols-8 gap-2\">
                {racks[rackNum].sort((a, b) => a.slot_number - b.slot_number).map(slot => (
                  <button
                    key={slot.id}
                    className={`
                      h-16 border-2 rounded-lg flex flex-col items-center justify-center
                      transition-all duration-200 transform hover:scale-105
                      ${getSlotStatusColor(slot.status)}
                    `}
                    title={`${slot.slot_code} - ${slot.status}${slot.occupied_weight_kg > 0 ? ` (${slot.occupied_weight_kg} KG)` : ''}`}
                    data-testid={`slot-${slot.id}`}
                  >
                    <span className=\"text-xs font-medium\">{slot.slot_number}</span>
                    {slot.occupied_weight_kg > 0 && (
                      <span className=\"text-[10px] opacity-90\">{slot.occupied_weight_kg}kg</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className=\"text-center py-12 text-slate-500\">
            <Box className=\"h-12 w-12 mx-auto mb-3 text-slate-300\" />
            <p>No slots configured for this chamber</p>
          </div>
        )}
      </div>
    );
  };

  const TemperatureMonitor = ({ chamberId }) => {
    const chamberLogs = temperatureLogs
      .filter(log => log.chamber_id === chamberId)
      .slice(0, 10);
    
    const chamber = chambers.find(c => c.id === chamberId);

    return (
      <div className=\"space-y-4\">
        {chamber && (
          <div className=\"grid grid-cols-3 gap-4\">
            <Card>
              <CardHeader className=\"pb-2\">
                <CardTitle className=\"text-sm font-medium text-slate-600\">Setpoint</CardTitle>
              </CardHeader>
              <CardContent>
                <div className=\"text-2xl font-bold text-blue-600\">
                  {chamber.setpoint_temperature_c}00b0C
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className=\"pb-2\">
                <CardTitle className=\"text-sm font-medium text-slate-600\">Current</CardTitle>
              </CardHeader>
              <CardContent>
                <div className=\"text-2xl font-bold text-green-600\">
                  {chamberLogs[0]?.temperature_c || '--'}00b0C
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className=\"pb-2\">
                <CardTitle className=\"text-sm font-medium text-slate-600\">Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className=\"text-2xl font-bold text-red-600\">
                  {chamberLogs.filter(log => log.alert).length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className=\"flex items-center gap-2\">
              <Thermometer className=\"h-5 w-5\" />
              Recent Temperature Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className=\"space-y-2\">
              {chamberLogs.map((log, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    log.alert ? 'bg-red-50 border border-red-200' : 'bg-slate-50'
                  }`}
                >
                  <div className=\"flex items-center gap-3\">
                    {log.alert ? (
                      <AlertTriangle className=\"h-5 w-5 text-red-600\" />
                    ) : (
                      <CheckCircle className=\"h-5 w-5 text-green-600\" />
                    )}
                    <div>
                      <p className=\"font-medium text-slate-800\">{log.temperature_c}00b0C</p>
                      <p className=\"text-xs text-slate-500\">
                        {new Date(log.recorded_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {log.alert && (
                    <span className=\"text-xs text-red-600 font-medium\">{log.alert_reason}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className=\"flex items-center justify-center h-screen\">
        <div className=\"animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600\"></div>
      </div>
    );
  }

  return (
    <div className=\"space-y-6\" data-testid=\"cold-storage-page\">
      <div className=\"flex items-center justify-between\">
        <div>
          <h1 className=\"text-2xl lg:text-3xl font-bold text-slate-800\">Cold Storage</h1>
          <p className=\"text-slate-600 mt-1\">Monitor chambers, slots, and temperature</p>
        </div>
      </div>

      {chambers.length > 0 ? (
        <div className=\"space-y-4\">
          <div className=\"flex gap-2 flex-wrap\">
            {chambers.map(chamber => (
              <Button
                key={chamber.id}
                variant={selectedChamber === chamber.id ? 'default' : 'outline'}
                onClick={() => setSelectedChamber(chamber.id)}
                className=\"gap-2\"
                data-testid={`chamber-btn-${chamber.id}`}
              >
                <Snowflake size={16} />
                {chamber.chamber_code} - {chamber.chamber_name}
              </Button>
            ))}
          </div>

          {selectedChamber && (
            <Tabs defaultValue=\"slots\" className=\"w-full\">
              <TabsList className=\"grid w-full grid-cols-3\">
                <TabsTrigger value=\"slots\">Slot Map</TabsTrigger>
                <TabsTrigger value=\"temperature\">Temperature</TabsTrigger>
                <TabsTrigger value=\"inventory\">Inventory</TabsTrigger>
              </TabsList>
              
              <TabsContent value=\"slots\" className=\"mt-4\">
                <Card>
                  <CardHeader>
                    <CardTitle>Visual Slot Layout</CardTitle>
                    <div className=\"flex gap-4 mt-4 text-sm\">
                      <div className=\"flex items-center gap-2\">
                        <div className=\"w-4 h-4 bg-slate-100 border-2 border-slate-300 rounded\"></div>
                        <span>Empty</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <div className=\"w-4 h-4 bg-blue-500 border-2 border-blue-600 rounded\"></div>
                        <span>Occupied</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <div className=\"w-4 h-4 bg-yellow-500 border-2 border-yellow-600 rounded\"></div>
                        <span>Reserved</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <div className=\"w-4 h-4 bg-red-500 border-2 border-red-600 rounded\"></div>
                        <span>Maintenance</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SlotMap chamberId={selectedChamber} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value=\"temperature\" className=\"mt-4\">
                <TemperatureMonitor chamberId={selectedChamber} />
              </TabsContent>

              <TabsContent value=\"inventory\" className=\"mt-4\">
                <Card>
                  <CardHeader>
                    <CardTitle>Current Inventory</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className=\"space-y-3\">
                      {inventory.map((item, index) => {
                        const slot = slots.find(s => s.id === item.slot_id);
                        return (
                          <div key={index} className=\"flex items-center justify-between p-4 bg-slate-50 rounded-lg\">
                            <div>
                              <p className=\"font-medium text-slate-800\">Slot: {slot?.slot_code || 'N/A'}</p>
                              <p className=\"text-sm text-slate-500\">FG ID: {item.fg_id}</p>
                            </div>
                            <div className=\"text-right\">
                              <p className=\"font-bold text-slate-800\">{item.quantity_kg} KG</p>
                              <p className=\"text-xs text-slate-500\">{item.days_in_storage} days in storage</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className=\"flex flex-col items-center justify-center py-12\">
            <Snowflake className=\"h-16 w-16 text-slate-300 mb-4\" />
            <p className=\"text-slate-500 text-center\">No cold storage chambers configured.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ColdStorage;
