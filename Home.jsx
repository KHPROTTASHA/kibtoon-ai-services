import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Services from "../components/Services";
import Industries from "../components/Industries";
import Process from "../components/Process";
import AIDemo from "../components/AIDemo";
import AIReadiness from "../components/AIReadiness";
import ROICalculator from "../components/ROICalculator";
import Solutions from "../components/Solutions";
import CaseStudies from "../components/CaseStudies";
import Pricing from "../components/Pricing";
import ConsultationForm from "../components/ConsultationForm";
import Footer from "../components/Footer";
import AIChatbot from "../components/AIChatbot";

const Home = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg-main text-white">

      {/* Navigation */}
      <Navbar />

      {/* Main Website Content */}
      <main>

        {/* Hero */}
        <Hero />

        {/* AI Services */}
        <Services />

        {/* Industries */}
        <Industries />

        {/* How We Work */}
        <Process />

        {/* Interactive AI Demo */}
        <AIDemo />

        {/* AI Readiness Assessment */}
        <AIReadiness />

        {/* ROI Calculator */}
        <ROICalculator />

        {/* AI Solutions */}
        <Solutions />

        {/* Case Studies */}
        <CaseStudies />

        {/* Pricing */}
        <Pricing />

        {/* Consultation */}
        <ConsultationForm />

      </main>

      {/* Footer */}
      <Footer />

      {/* Floating AI Assistant */}
      <AIChatbot />

    </div>
  );
};

export default Home;