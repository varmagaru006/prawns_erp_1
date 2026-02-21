import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Users, ShoppingCart, Ship, DollarSign } from 'lucide-react';

const Sales = () => {
  const [buyers, setBuyers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [buyersRes, ordersRes, shipmentsRes] = await Promise.all([
        axios.get(`${API}/buyers`),
        axios.get(`${API}/sales/orders`),
        axios.get(`${API}/shipments`)
      ]);
      setBuyers(buyersRes.data);
      setOrders(ordersRes.data);
      setShipments(shipmentsRes.data);
    } catch (error) {
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-800',
      confirmed: 'bg-blue-100 text-blue-800',
      in_transit: 'bg-yellow-100 text-yellow-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Sales & Dispatch</h1>
          <p className="text-slate-600 mt-1">Manage buyers, orders, and shipments</p>
        </div>
      </div>

      <Tabs defaultValue="buyers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="buyers">Buyers</TabsTrigger>
          <TabsTrigger value="orders">Sales Orders</TabsTrigger>
          <TabsTrigger value="shipments">Shipments</TabsTrigger>
        </TabsList>

        <TabsContent value="buyers" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Export Buyers</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {buyers.map(buyer => (
                  <Card key={buyer.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{buyer.company_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600">Country:</span>
                        <span className="font-medium">{buyer.country}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600">Contact:</span>
                        <span className="font-medium">{buyer.contact_person}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600">Email:</span>
                        <span className="font-medium text-blue-600">{buyer.email}</span>
                      </div>
                      {buyer.ie_code && (
                        <div className="text-xs text-slate-500">IE Code: {buyer.ie_code}</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {buyers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">No buyers found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Quantity (KG)</TableHead>
                      <TableHead>Rate (USD/KG)</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.buyer_name}</TableCell>
                        <TableCell>{order.quantity_kg.toFixed(2)}</TableCell>
                        <TableCell>${order.rate_per_kg_usd.toFixed(2)}</TableCell>
                        <TableCell className="font-bold text-green-600">
                          ${order.total_value_usd.toLocaleString()}
                        </TableCell>
                        <TableCell>{new Date(order.delivery_date).toLocaleDateString()}</TableCell>
                        <TableCell>{getStatusBadge(order.payment_status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <ShoppingCart className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">No sales orders found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Shipments</CardTitle>
            </CardHeader>
            <CardContent>
              {shipments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment Number</TableHead>
                      <TableHead>Container</TableHead>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Port of Loading</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>ETD</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map(shipment => (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">{shipment.shipment_number}</TableCell>
                        <TableCell>{shipment.container_no}</TableCell>
                        <TableCell>{shipment.vessel_name}</TableCell>
                        <TableCell>{shipment.port_of_loading}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{shipment.port_of_discharge}</p>
                            <p className="text-xs text-slate-500">{shipment.destination_country}</p>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(shipment.etd).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(shipment.eta).toLocaleDateString()}</TableCell>
                        <TableCell>{getStatusBadge(shipment.shipment_status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Ship className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">No shipments found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Sales;
