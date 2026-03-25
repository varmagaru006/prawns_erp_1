import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Users, Phone, CreditCard } from 'lucide-react';

const Agents = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    agent_code: '',
    name: '',
    phone: '',
    gst: '',
    pan: '',
    commission_pct: 0,
    bank_name: '',
    account_number: '',
    ifsc: '',
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await axios.get(`${API}/agents`);
      setAgents(response.data);
    } catch (error) {
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/agents`, formData);
      toast.success('Agent added successfully');
      setOpen(false);
      setFormData({
        agent_code: '',
        name: '',
        phone: '',
        gst: '',
        pan: '',
        commission_pct: 0,
        bank_name: '',
        account_number: '',
        ifsc: '',
      });
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add agent');
    }
  };

  return (
    <div className="space-y-6" data-testid="agents-page">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Agents</h1>
          <p className="text-slate-600 mt-1">Manage procurement agents and vendors</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 sm:w-auto" data-testid="add-agent-button">
              <Plus size={18} />
              Add Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Agent</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agent_code">Agent Code *</Label>
                  <Input
                    id="agent_code"
                    value={formData.agent_code}
                    onChange={(e) => setFormData({ ...formData, agent_code: e.target.value })}
                    required
                    data-testid="agent-code-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="agent-name-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    data-testid="agent-phone-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_pct">Commission %</Label>
                  <Input
                    id="commission_pct"
                    type="number"
                    step="0.01"
                    value={formData.commission_pct}
                    onChange={(e) => setFormData({ ...formData, commission_pct: parseFloat(e.target.value) })}
                    data-testid="agent-commission-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst">GST Number</Label>
                  <Input
                    id="gst"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                    data-testid="agent-gst-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN Number</Label>
                  <Input
                    id="pan"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                    data-testid="agent-pan-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  data-testid="agent-bank-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    data-testid="agent-account-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifsc">IFSC Code</Label>
                  <Input
                    id="ifsc"
                    value={formData.ifsc}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value })}
                    data-testid="agent-ifsc-input"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" data-testid="submit-agent-button">
                Add Agent
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} data-testid={`agent-card-${agent.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg">{agent.name}</span>
                  <span className="text-sm font-normal text-slate-500">{agent.agent_code}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={16} className="text-slate-500" />
                  <span data-testid={`agent-phone-${agent.id}`}>{agent.phone}</span>
                </div>
                {agent.gst && (
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard size={16} className="text-slate-500" />
                    <span>GST: {agent.gst}</span>
                  </div>
                )}
                {agent.commission_pct > 0 && (
                  <div className="text-sm">
                    <span className="text-slate-600">Commission: </span>
                    <span className="font-medium">{agent.commission_pct}%</span>
                  </div>
                )}
                {agent.bank_name && (
                  <div className="text-sm text-slate-600">
                    Bank: {agent.bank_name}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && agents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">No agents found. Add your first agent to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Agents;
