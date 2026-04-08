import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
export function EmptyFocus(){
  return(
    <motion.div className="text-center py-12 space-y-3" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.2}}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{background:'rgba(139,92,246,0.07)',border:'1px solid rgba(139,92,246,0.1)'}}><Timer size={28} style={{color:'rgba(167,139,250,0.28)'}}/></div>
      <p className="text-sm font-medium font-heading" style={{color:'var(--ag-text-secondary)'}}>No focus sessions yet</p>
      <p className="text-xs opacity-60" style={{color:'var(--ag-text-secondary)'}}>Start a session to begin tracking your deep work.</p>
    </motion.div>
  );
}
