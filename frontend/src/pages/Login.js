import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Loader2, Fish, Waves, TrendingUp, Package, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('worker');
  const [loading, setLoading] = useState(false);
  const [floatingElements, setFloatingElements] = useState([]);
  
  const { login, register } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  useEffect(() => {
    // Create floating elements for animation
    const elements = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      delay: i * 0.5,
      duration: 15 + Math.random() * 10,
      left: Math.random() * 100,
      size: 40 + Math.random() * 60
    }));
    setFloatingElements(elements);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome back! 🎉');
        navigate('/');
      } else {
        await register({ email, password, name, phone, role });
        toast.success('Account created! Please login.');
        setIsLogin(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Package, text: 'Complete Traceability', color: 'text-blue-600' },
    { icon: TrendingUp, text: 'Real-time Analytics', color: 'text-green-600' },
    { icon: ShieldCheck, text: 'Quality Assurance', color: 'text-purple-600' }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          {floatingElements.map((element) => (
            <div
              key={element.id}
              className="absolute rounded-full bg-white"
              style={{
                left: `${element.left}%`,
                width: `${element.size}px`,
                height: `${element.size}px`,
                animation: `float ${element.duration}s infinite ease-in-out`,
                animationDelay: `${element.delay}s`,
                opacity: 0.3
              }}
            />
          ))}
        </div>
        
        {/* Wave Effect */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-64" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path
              fill="rgba(255,255,255,0.1)"
              d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            >
              <animate attributeName="d" dur="10s" repeatCount="indefinite" values="
                M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z;
                M0,128L48,154.7C96,181,192,235,288,234.7C384,235,480,181,576,181.3C672,181,768,235,864,250.7C960,267,1056,245,1152,229.3C1248,213,1344,203,1392,197.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z;
                M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z;
              " />
            </path>
          </svg>
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Branding */}
          <div className="text-white space-y-6 hidden lg:block animate-fadeIn">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                <Fish className="h-12 w-12" />
              </div>
              <div>
                <h1 className="text-5xl font-bold">Prawn ERP</h1>
                <p className="text-blue-100 text-lg">Aquaculture Export Management</p>
              </div>
            </div>

            <p className="text-xl text-blue-50 leading-relaxed">
              Complete lifecycle management from procurement to export. Track, monitor, and optimize your seafood processing operations.
            </p>

            <div className="space-y-4 pt-4">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div 
                    key={index} 
                    className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-xl p-4 transform transition-all duration-300 hover:scale-105 hover:bg-white/20"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="p-3 bg-white rounded-lg">
                      <Icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <span className="text-lg font-medium">{feature.text}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-6 pt-6 text-blue-100">
              <div className="flex items-center gap-2">
                <Waves className="h-5 w-5" />
                <span>7 Integrated Modules</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span>ISO Compliant</span>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <Card className="backdrop-blur-xl bg-white/95 shadow-2xl border-0 animate-scaleIn" data-testid="login-card">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
                <Fish className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </CardTitle>
              <CardDescription className="text-base">
                {isLogin ? 'Sign in to access your dashboard' : 'Register to get started with Prawn ERP'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-slate-700 font-medium">Full Name</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="h-12 border-2 focus:border-blue-500"
                        data-testid="name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-slate-700 font-medium">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-12 border-2 focus:border-blue-500"
                        data-testid="phone-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-slate-700 font-medium">Role</Label>
                      <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full h-12 px-3 py-2 border-2 border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        data-testid="role-select"
                      >
                        <option value="admin">Admin</option>
                        <option value="procurement_manager">Procurement Manager</option>
                        <option value="production_supervisor">Production Supervisor</option>
                        <option value="cold_storage_incharge">Cold Storage Incharge</option>
                        <option value="qc_officer">QC Officer</option>
                        <option value="sales_manager">Sales Manager</option>
                        <option value="accounts_manager">Accounts Manager</option>
                        <option value="worker">Worker</option>
                      </select>
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 border-2 focus:border-blue-500"
                    placeholder="your@email.com"
                    data-testid="email-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 border-2 focus:border-blue-500"
                    placeholder="••••••••"
                    data-testid="password-input"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-[1.02]"
                  disabled={loading}
                  data-testid="auth-submit-button"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Please wait
                    </>
                  ) : (
                    isLogin ? 'Sign In' : 'Create Account'
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                    data-testid="toggle-auth-mode"
                  >
                    {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-20px) rotate(5deg);
          }
          50% {
            transform: translateY(-40px) rotate(-5deg);
          }
          75% {
            transform: translateY(-20px) rotate(3deg);
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
