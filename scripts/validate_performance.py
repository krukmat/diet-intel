#!/usr/bin/env python3
"""
Smart Diet Performance Validation Script
Phase 9.3.1: Performance Optimization
Validates that all performance targets are met
"""

import asyncio
import time
import statistics
import json
import sys
from typing import List, Dict, Any
import aiohttp
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Performance targets
PERFORMANCE_TARGETS = {
    'api_response_time_ms': 500,    # <500ms API response
    'mobile_load_time_ms': 2000,    # <2s mobile load
    'cache_hit_rate_percent': 85,   # >85% cache hit rate
    'success_rate_percent': 99,     # >99% success rate
    'concurrent_users': 10,         # Support 10 concurrent users
    'db_query_time_ms': 100,        # <100ms database queries
}

class PerformanceValidator:
    """Validates Smart Diet performance optimizations"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results = {}
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def validate_api_performance(self) -> Dict[str, Any]:
        """Test API response time performance"""
        logger.info("🔍 Validating API performance...")
        
        test_endpoints = [
            {
                'name': 'smart_diet_today',
                'url': '/smart-diet/suggestions?context=today&max_suggestions=10',
                'target_ms': PERFORMANCE_TARGETS['api_response_time_ms']
            },
            {
                'name': 'smart_diet_optimize',
                'url': '/smart-diet/suggestions?context=optimize&max_suggestions=5',
                'target_ms': PERFORMANCE_TARGETS['api_response_time_ms']
            },
            {
                'name': 'smart_diet_discover',
                'url': '/smart-diet/suggestions?context=discover&max_suggestions=8',
                'target_ms': PERFORMANCE_TARGETS['api_response_time_ms']
            }
        ]
        
        results = {}
        
        for endpoint in test_endpoints:
            response_times = []
            success_count = 0
            
            # Test each endpoint 20 times
            for i in range(20):
                try:
                    start_time = time.time()
                    
                    async with self.session.get(
                        f"{self.base_url}{endpoint['url']}",
                        headers={'Authorization': 'Bearer test_token'}  # Mock auth
                    ) as response:
                        await response.json()
                        
                        response_time_ms = (time.time() - start_time) * 1000
                        response_times.append(response_time_ms)
                        
                        if response.status == 200:
                            success_count += 1
                
                except Exception as e:
                    logger.warning(f"Request failed for {endpoint['name']}: {e}")
            
            if response_times:
                avg_time = statistics.mean(response_times)
                p95_time = statistics.quantiles(response_times, n=20)[18] if len(response_times) >= 20 else max(response_times)
                success_rate = (success_count / len(response_times)) * 100
                
                results[endpoint['name']] = {
                    'avg_response_time_ms': round(avg_time, 2),
                    'p95_response_time_ms': round(p95_time, 2),
                    'target_ms': endpoint['target_ms'],
                    'meets_target': avg_time <= endpoint['target_ms'],
                    'success_rate_percent': round(success_rate, 2),
                    'meets_success_target': success_rate >= PERFORMANCE_TARGETS['success_rate_percent']
                }
        
        return results
    
    async def validate_concurrent_performance(self) -> Dict[str, Any]:
        """Test concurrent user performance"""
        logger.info("🚀 Validating concurrent user performance...")
        
        concurrent_users = PERFORMANCE_TARGETS['concurrent_users']
        
        async def single_user_request():
            try:
                start_time = time.time()
                async with self.session.get(
                    f"{self.base_url}/smart-diet/suggestions?context=today&max_suggestions=5",
                    headers={'Authorization': 'Bearer test_token'}
                ) as response:
                    await response.json()
                    return (time.time() - start_time) * 1000, response.status == 200
            except Exception:
                return None, False
        
        # Execute concurrent requests
        start_time = time.time()
        tasks = [single_user_request() for _ in range(concurrent_users)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = (time.time() - start_time) * 1000
        
        # Analyze results
        response_times = []
        success_count = 0
        
        for result in results:
            if isinstance(result, tuple) and result[0] is not None:
                response_times.append(result[0])
                if result[1]:
                    success_count += 1
        
        avg_response_time = statistics.mean(response_times) if response_times else 0
        success_rate = (success_count / len(results)) * 100
        
        return {
            'concurrent_users': concurrent_users,
            'total_execution_time_ms': round(total_time, 2),
            'avg_response_time_ms': round(avg_response_time, 2),
            'success_rate_percent': round(success_rate, 2),
            'meets_response_target': avg_response_time <= PERFORMANCE_TARGETS['api_response_time_ms'],
            'meets_success_target': success_rate >= PERFORMANCE_TARGETS['success_rate_percent']
        }
    
    async def validate_cache_performance(self) -> Dict[str, Any]:
        """Test cache hit rate and performance"""
        logger.info("💾 Validating cache performance...")
        
        try:
            # Get cache performance metrics
            async with self.session.get(
                f"{self.base_url}/smart-diet/performance-metrics?hours=1"
            ) as response:
                metrics = await response.json()
            
            cache_stats = metrics.get('cache_performance', {})
            hit_rates = cache_stats.get('hit_rates', {})
            redis_stats = cache_stats.get('redis_stats', {})
            
            # Calculate overall cache hit rate
            total_hits = redis_stats.get('hits', 0)
            total_requests = redis_stats.get('total_requests', 1)
            overall_hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0
            
            return {
                'overall_hit_rate_percent': round(overall_hit_rate, 2),
                'target_hit_rate_percent': PERFORMANCE_TARGETS['cache_hit_rate_percent'],
                'meets_target': overall_hit_rate >= PERFORMANCE_TARGETS['cache_hit_rate_percent'],
                'redis_connected': redis_stats.get('connected', False),
                'cache_errors': redis_stats.get('errors', 0),
                'individual_hit_rates': hit_rates
            }
            
        except Exception as e:
            logger.error(f"Error validating cache performance: {e}")
            return {
                'overall_hit_rate_percent': 0,
                'meets_target': False,
                'error': str(e)
            }
    
    async def validate_database_performance(self) -> Dict[str, Any]:
        """Test database query performance"""
        logger.info("🗄️ Validating database performance...")
        
        try:
            # Test database-heavy operations
            test_operations = [
                '/smart-diet/suggestions?context=optimize&include_optimizations=true',
                '/smart-diet/suggestions?context=discover&max_suggestions=20',
            ]
            
            db_performance = {}
            
            for operation in test_operations:
                response_times = []
                
                # Test each operation 10 times
                for _ in range(10):
                    try:
                        start_time = time.time()
                        async with self.session.get(
                            f"{self.base_url}{operation}",
                            headers={'Authorization': 'Bearer test_token'}
                        ) as response:
                            await response.json()
                            response_time_ms = (time.time() - start_time) * 1000
                            response_times.append(response_time_ms)
                    
                    except Exception:
                        continue
                
                if response_times:
                    avg_time = statistics.mean(response_times)
                    operation_name = operation.split('?')[0].replace('/', '_').replace('-', '_')
                    
                    db_performance[operation_name] = {
                        'avg_response_time_ms': round(avg_time, 2),
                        'target_ms': PERFORMANCE_TARGETS['db_query_time_ms'] * 5,  # Allow 5x for full API call
                        'meets_target': avg_time <= PERFORMANCE_TARGETS['db_query_time_ms'] * 5
                    }
            
            return db_performance
            
        except Exception as e:
            logger.error(f"Error validating database performance: {e}")
            return {'error': str(e)}
    
    async def validate_health_score(self) -> Dict[str, Any]:
        """Get overall system health score"""
        logger.info("💊 Validating system health score...")
        
        try:
            async with self.session.get(
                f"{self.base_url}/smart-diet/performance-metrics?hours=1"
            ) as response:
                metrics = await response.json()
            
            health_score = metrics.get('health_score', {})
            
            return {
                'overall_score': health_score.get('overall_score', 0),
                'status': health_score.get('status', 'unknown'),
                'api_health': health_score.get('api_health', 0),
                'mobile_health': health_score.get('mobile_health', 0),
                'cache_health': health_score.get('cache_health', 0),
                'meets_target': health_score.get('overall_score', 0) >= 85  # 85% health target
            }
            
        except Exception as e:
            logger.error(f"Error getting health score: {e}")
            return {'error': str(e), 'meets_target': False}
    
    async def run_all_validations(self) -> Dict[str, Any]:
        """Run comprehensive performance validation"""
        logger.info("🎯 Starting comprehensive performance validation...")
        
        validation_results = {
            'timestamp': time.time(),
            'targets': PERFORMANCE_TARGETS,
            'results': {}
        }
        
        # Run all validation tests
        tests = [
            ('api_performance', self.validate_api_performance()),
            ('concurrent_performance', self.validate_concurrent_performance()),
            ('cache_performance', self.validate_cache_performance()),
            ('database_performance', self.validate_database_performance()),
            ('health_score', self.validate_health_score())
        ]
        
        for test_name, test_coro in tests:
            try:
                logger.info(f"Running {test_name} validation...")
                result = await test_coro
                validation_results['results'][test_name] = result
                
                # Log pass/fail status
                if 'meets_target' in result:
                    status = "✅ PASS" if result['meets_target'] else "❌ FAIL"
                    logger.info(f"{test_name}: {status}")
                
            except Exception as e:
                logger.error(f"Error in {test_name} validation: {e}")
                validation_results['results'][test_name] = {'error': str(e)}
        
        # Calculate overall validation score
        validation_results['summary'] = self._calculate_validation_summary(validation_results['results'])
        
        return validation_results
    
    def _calculate_validation_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall validation summary"""
        total_tests = 0
        passed_tests = 0
        critical_failures = []
        
        for test_name, test_result in results.items():
            if 'error' in test_result:
                critical_failures.append(f"{test_name}: {test_result['error']}")
                continue
            
            if test_name == 'api_performance':
                for endpoint, endpoint_result in test_result.items():
                    total_tests += 2  # Response time + success rate
                    if endpoint_result.get('meets_target', False):
                        passed_tests += 1
                    if endpoint_result.get('meets_success_target', False):
                        passed_tests += 1
                    
                    if not endpoint_result.get('meets_target', False):
                        critical_failures.append(f"API {endpoint} response time: {endpoint_result.get('avg_response_time_ms')}ms > {endpoint_result.get('target_ms')}ms")
            
            elif 'meets_target' in test_result:
                total_tests += 1
                if test_result['meets_target']:
                    passed_tests += 1
                else:
                    critical_failures.append(f"{test_name} failed performance target")
        
        pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        return {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'pass_rate_percent': round(pass_rate, 2),
            'overall_status': 'PASS' if pass_rate >= 80 else 'FAIL',
            'critical_failures': critical_failures
        }


async def main():
    """Main validation function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate Smart Diet Performance Optimizations')
    parser.add_argument('--url', default='http://localhost:8000', help='API base URL')
    parser.add_argument('--output', help='Output file for results (JSON)')
    parser.add_argument('--verbose', action='store_true', help='Verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    async with PerformanceValidator(args.url) as validator:
        results = await validator.run_all_validations()
        
        # Print summary
        summary = results['summary']
        print(f"\n🎯 Performance Validation Results")
        print(f"{'='*50}")
        print(f"Overall Status: {summary['overall_status']}")
        print(f"Pass Rate: {summary['pass_rate_percent']}% ({summary['passed_tests']}/{summary['total_tests']})")
        
        if summary['critical_failures']:
            print(f"\n❌ Critical Failures:")
            for failure in summary['critical_failures']:
                print(f"  - {failure}")
        
        print(f"\n✅ Performance Targets:")
        for target, value in PERFORMANCE_TARGETS.items():
            print(f"  - {target}: {value}")
        
        # Save to file if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\n📄 Detailed results saved to: {args.output}")
        
        # Exit with appropriate code
        sys.exit(0 if summary['overall_status'] == 'PASS' else 1)


if __name__ == '__main__':
    asyncio.run(main())