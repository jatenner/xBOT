import { plan } from "../src/pipeline/plan";
import { generate } from "../src/pipeline/generate";
import { vet } from "../src/pipeline/vet";

(async () => {
  console.log('🧪 Running pipeline batch test...');
  
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`\n--- Batch ${i + 1}/5 ---`);
      
      const p = await plan();
      console.log(`📋 Plan: ${p.format} about ${p.topic} (${p.reasoning})`);
      
      const g = await generate(p);
      console.log(`✨ Generated: "${g.text.substring(0, 50)}..." (score: ${g.estimated_engagement_score.toFixed(2)})`);
      
      const v = await vet(g);
      console.log(`🔍 Vetted: ${v.approved ? 'APPROVED' : 'REJECTED'} (${v.scores.overall.toFixed(2)})`);
      
      if (v.approved) {
        console.log(`📊 Quality: Novelty ${v.scores.novelty.toFixed(2)}, Hook ${v.scores.hook_strength.toFixed(2)}, Clarity ${v.scores.clarity.toFixed(2)}`);
      } else {
        console.log(`❌ Rejection: ${v.rejection_reason}`);
      }
      
    } catch (error) {
      console.error(`❌ Batch ${i + 1} failed:`, error.message);
    }
  }
  
  console.log('\n✅ Batch test completed');
  process.exit(0);
})();
