import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');

export const options = {
  // Growth loop soak test: 200 RPS for 1 minute
  stages: [
    { duration: '10s', target: 50 },   // Ramp up
    { duration: '40s', target: 200 },  // Stay at 200 RPS
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],    // <1% failures
    errors: ['rate<0.01'],             // <1% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://snap2health-xbot.onrender.com';

export default function () {
  // Test health endpoint
  const healthRes = http.get(`${BASE_URL}/health`);
  const healthCheck = check(healthRes, {
    'health endpoint responds': (r) => r.status === 200,
    'health response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!healthCheck) {
    errorRate.add(1);
  }

  // Test metrics endpoint (Prometheus format)
  const metricsRes = http.get(`${BASE_URL}/metrics`);
  const metricsCheck = check(metricsRes, {
    'metrics endpoint responds': (r) => r.status === 200,
    'metrics contain growth data': (r) => 
      r.body.includes('followers_per_1k_impressions') || 
      r.body.includes('engagement_rate'),
    'metrics response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (!metricsCheck) {
    errorRate.add(1);
  }

  // Test dashboard endpoint
  const dashboardRes = http.get(`${BASE_URL}/dashboard`);
  const dashboardCheck = check(dashboardRes, {
    'dashboard responds': (r) => r.status === 200 || r.status === 404, // 404 is acceptable if not implemented
  });

  // Small delay between requests
  sleep(Math.random() * 0.5);
}

export function handleSummary(data) {
  return {
    'soak-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
🚀 GROWTH LOOP SOAK TEST RESULTS
===============================
✅ Total Requests: ${data.metrics.http_reqs.values.count}
📊 Average Duration: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
📈 95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
❌ Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%
🎯 Error Rate: ${data.metrics.errors ? data.metrics.errors.values.rate * 100 : 0}%

${data.metrics.http_req_failed.values.rate < 0.01 ? '✅ PASS' : '❌ FAIL'}: Error rate under 1%
${data.metrics.http_req_duration.values['p(95)'] < 2000 ? '✅ PASS' : '❌ FAIL'}: 95% requests under 2s
`,
  };
} 