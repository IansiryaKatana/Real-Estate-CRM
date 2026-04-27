import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { useCompanies, usePortfolios, useProperties, formatCurrency } from "@/hooks/useSupabaseData";
import { Building2, Plus, ChevronRight, FolderOpen, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const typeColors: Record<string, string> = {
  residential: "bg-success/10 text-success border-success/20",
  commercial: "bg-primary/10 text-accent-foreground border-primary/20",
  off_plan: "bg-warning/10 text-warning border-warning/20",
  mixed: "bg-accent text-accent-foreground border-accent-foreground/20",
};

export default function PortfoliosPage() {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", owner: "", email: "", phone: "" });
  const [portfolioForm, setPortfolioForm] = useState({ name: "", company_id: "", type: "residential" });

  const { data: companies = [] } = useCompanies();
  const { data: portfolios = [] } = usePortfolios(selectedCompany);
  const { data: properties = [] } = useProperties();
  const qc = useQueryClient();

  const getPortfolioValue = (portfolioId: string) => formatCurrency(properties.filter(p => p.portfolio_id === portfolioId).reduce((sum, p) => sum + Number(p.price), 0));
  const getPortfolioPropertyCount = (portfolioId: string) => properties.filter(p => p.portfolio_id === portfolioId).length;
  const getCompanyPortfolioCount = (companyId: string) => portfolios.filter(p => p.company_id === companyId).length;

  const handleCreateCompany = async () => {
    const { error } = await supabase.from("companies").insert({ name: companyForm.name, owner: companyForm.owner, email: companyForm.email || null, phone: companyForm.phone || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Company created"); qc.invalidateQueries({ queryKey: ["companies"] }); setShowCreateCompany(false);
    setCompanyForm({ name: "", owner: "", email: "", phone: "" });
  };

  const handleCreatePortfolio = async () => {
    const { error } = await supabase.from("portfolios").insert({ name: portfolioForm.name, company_id: portfolioForm.company_id, type: portfolioForm.type as any });
    if (error) { toast.error(error.message); return; }
    toast.success("Portfolio created"); qc.invalidateQueries({ queryKey: ["portfolios"] }); setShowCreatePortfolio(false);
    setPortfolioForm({ name: "", company_id: "", type: "residential" });
  };

  return (
    <PageShell title="Portfolios" subtitle="Manage companies and property portfolios"
      actions={
        <div className="flex gap-2">
          <Dialog open={showCreateCompany} onOpenChange={setShowCreateCompany}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="hidden sm:inline-flex"><Plus className="mr-1 h-4 w-4" /> Company</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Company</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Company Name</Label><Input placeholder="Enter company name" value={companyForm.name} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Owner</Label><Input placeholder="Owner name" value={companyForm.owner} onChange={e => setCompanyForm(f => ({ ...f, owner: e.target.value }))} /></div>
                <div><Label>Email</Label><Input type="email" placeholder="company@email.com" value={companyForm.email} onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input placeholder="+971 ..." value={companyForm.phone} onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <Button className="w-full" onClick={handleCreateCompany} disabled={!companyForm.name || !companyForm.owner}>Create Company</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showCreatePortfolio} onOpenChange={setShowCreatePortfolio}>
            <DialogTrigger asChild><Button size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"><Plus className="h-4 w-4" /><span className="hidden sm:inline ml-1">Portfolio</span></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Portfolio</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Portfolio Name</Label><Input placeholder="Enter portfolio name" value={portfolioForm.name} onChange={e => setPortfolioForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <Label>Company</Label>
                  <Select value={portfolioForm.company_id} onValueChange={v => setPortfolioForm(f => ({ ...f, company_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={portfolioForm.type} onValueChange={v => setPortfolioForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">Residential</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="off_plan">Off-Plan</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreatePortfolio} disabled={!portfolioForm.name || !portfolioForm.company_id}>Create Portfolio</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="mb-5">
        <h2 className="mb-3 font-heading text-xs md:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Companies</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company, i) => (
            <motion.div key={company.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={`cursor-pointer p-3 md:p-4 transition-all hover:shadow-md ${selectedCompany === company.id ? "border-primary ring-2 ring-primary/20" : ""}`}
                onClick={() => setSelectedCompany(selectedCompany === company.id ? null : company.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent shrink-0"><Building2 className="h-5 w-5 text-accent-foreground" /></div>
                    <div className="min-w-0">
                      <p className="font-heading text-sm font-semibold text-card-foreground truncate">{company.name}</p>
                      <p className="text-xs text-muted-foreground">{company.owner}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>{getCompanyPortfolioCount(company.id)} portfolios</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-heading text-xs md:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {selectedCompany ? `Portfolios for ${companies.find(c => c.id === selectedCompany)?.name}` : "All Portfolios"}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((portfolio, i) => (
            <motion.div key={portfolio.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="group cursor-pointer p-3 md:p-4 transition-all hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0"><FolderOpen className="h-5 w-5 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="font-heading text-sm font-semibold text-card-foreground truncate">{portfolio.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{companies.find(c => c.id === portfolio.company_id)?.name}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 shrink-0" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="outline" className={typeColors[portfolio.type] ?? ""}>{portfolio.type.replace("_", "-")}</Badge>
                  <div className="text-right">
                    <p className="font-heading text-base md:text-lg font-bold text-card-foreground">{getPortfolioValue(portfolio.id)}</p>
                    <p className="text-xs text-muted-foreground">{getPortfolioPropertyCount(portfolio.id)} properties</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
