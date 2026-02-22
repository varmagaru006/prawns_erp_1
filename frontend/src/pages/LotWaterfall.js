import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, TrendingDown, DollarSign, Package, AlertTriangle } from 'lucide-react';

const LotWaterfall = () => {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const [waterfall, setWaterfall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWaterfall();
  }, [lotId]);

  const fetchWaterfall = async () => {
    try {
      const response = await axios.get(`${API}/wastage/lot-waterfall/${lotId}`);
      setWaterfall(response.data);
    } catch (error) {
      toast.error('Failed to load waterfall data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'amber': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!waterfall) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Package className="h-16 w-16 text-slate-300 mb-4" />
        <p className="text-slate-500 text-lg">Lot not found</p>
        <Button onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const totalYieldPct = waterfall.initial_weight_kg > 0
    ? ((waterfall.final_weight_kg / waterfall.initial_weight_kg) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">
            Lot Wastage Waterfall
          </h1>
          <p className="text-slate-600 mt-1">{waterfall.lot_number} - {waterfall.species}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Initial Weight</p>
                <p className="text-2xl font-bold text-slate-800">
                  {waterfall.initial_weight_kg.toFixed(2)} KG
                </p>
              </div>
              <Package className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Final Weight</p>
                <p className="text-2xl font-bold text-green-700">
                  {waterfall.final_weight_kg.toFixed(2)} KG
                </p>
              </div>
              <Package className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Wastage</p>
                <p className="text-2xl font-bold text-red-700">
                  {waterfall.total_wastage_kg.toFixed(2)} KG
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Overall Yield: {totalYieldPct.toFixed(1)}%
                </p>
              </div>
              <TrendingDown className="h-10 w-10 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Revenue Loss</p>
                <p className="text-2xl font-bold text-orange-700">
                  ₹{waterfall.total_revenue_loss_inr.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Net Loss: ₹{waterfall.total_net_loss_inr.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Waterfall Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Stage-by-Stage Journey</CardTitle>
        </CardHeader>
        <CardContent>
          {waterfall.stages.length > 0 ? (
            <div className="space-y-6">
              {/* Starting point */}
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                <div className="flex-shrink-0 w-32 text-center">
                  <p className="text-sm font-medium text-blue-700">START</p>
                  <p className="text-xs text-blue-600">Gate Entry</p>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-blue-800">
                    {waterfall.initial_weight_kg.toFixed(2)} KG
                  </p>
                  <p className="text-sm text-blue-600">Initial gross weight</p>
                </div>
              </div>

              {/* Each stage */}
              {waterfall.stages.map((stage, index) => (
                <div key={index}>
                  {/* Arrow */}
                  <div className="flex justify-center my-2">
                    <TrendingDown className="h-6 w-6 text-slate-400" />
                  </div>

                  {/* Stage card */}
                  <div className={`p-4 rounded-lg border-2 ${
                    stage.threshold_status === 'green' ? 'bg-green-50 border-green-300' :
                    stage.threshold_status === 'amber' ? 'bg-yellow-50 border-yellow-300' :
                    stage.threshold_status === 'red' ? 'bg-red-50 border-red-300' :
                    'bg-gray-50 border-gray-300'
                  }`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-32">
                        <p className="font-semibold text-sm capitalize">
                          {stage.stage_name?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-slate-600 capitalize">
                          {stage.process_type?.replace(/_/g, ' ')}
                        </p>
                        <div className="mt-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            stage.threshold_status === 'green' ? 'bg-green-200 text-green-800' :
                            stage.threshold_status === 'amber' ? 'bg-yellow-200 text-yellow-800' :
                            stage.threshold_status === 'red' ? 'bg-red-200 text-red-800' :
                            'bg-gray-200 text-gray-800'
                          }`}>
                            {stage.threshold_status?.toUpperCase() || 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-slate-600">Input</p>
                          <p className="font-semibold">{stage.input_weight_kg.toFixed(2)} KG</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Output</p>
                          <p className="font-semibold text-green-700">
                            {stage.output_weight_kg.toFixed(2)} KG
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Wastage</p>
                          <p className="font-semibold text-red-700">
                            -{stage.wastage_kg.toFixed(2)} KG
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600">Yield</p>
                          <p className="font-semibold">
                            {stage.yield_pct.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-slate-600">Revenue Loss</p>
                        <p className="font-semibold text-red-700">
                          ₹{stage.revenue_loss_inr.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Net: ₹{stage.net_loss_inr.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {stage.threshold_status === 'red' && (
                      <div className="mt-3 flex items-center gap-2 text-red-700 text-sm">
                        <AlertTriangle size={16} />
                        <span>Critical: Yield below minimum threshold</span>
                      </div>
                    )}
                    {stage.threshold_status === 'amber' && (
                      <div className="mt-3 flex items-center gap-2 text-yellow-700 text-sm">
                        <AlertTriangle size={16} />
                        <span>Warning: Yield below optimal threshold</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* End point */}
              <div className="flex justify-center my-2">
                <TrendingDown className="h-6 w-6 text-slate-400" />
              </div>
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg border-2 border-green-300">
                <div className="flex-shrink-0 w-32 text-center">
                  <p className="text-sm font-medium text-green-700">END</p>
                  <p className="text-xs text-green-600">Final Product</p>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-green-800">
                    {waterfall.final_weight_kg.toFixed(2)} KG
                  </p>
                  <p className="text-sm text-green-600">
                    Overall yield: {totalYieldPct.toFixed(1)}% from initial weight
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500">No processing stages found for this lot</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LotWaterfall;
