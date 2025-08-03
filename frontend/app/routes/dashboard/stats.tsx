import { Progress } from "@radix-ui/react-progress";
import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  Users,
  Target,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "~/components/ui/card";
import { callAPI } from "~/services/api";

export default function StatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["call-stats"],
    queryFn: () => callAPI.getCallStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const callStats = {
    totalCalls: stats?.data?.totalCalls || 0,
    completedCalls: stats?.data?.completedCalls || 0,
    failedCalls: stats?.data?.failedCalls || 0,
    transferredCalls: stats?.data?.transferredCalls || 0,
    initiatedCalls: stats?.data?.initiatedCalls || 0,
    averageDuration: stats?.data?.averageDuration || 0,
  };

  const conversionRate =
    callStats.totalCalls > 0
      ? ((callStats.completedCalls + callStats.transferredCalls) /
          callStats.totalCalls) *
        100
      : 0;

  const successRate =
    callStats.totalCalls > 0
      ? (callStats.completedCalls / callStats.totalCalls) * 100
      : 0;

  const transferRate =
    callStats.totalCalls > 0
      ? (callStats.transferredCalls / callStats.totalCalls) * 100
      : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistics</h1>
          <p className="text-gray-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Statistics Dashboard
        </h1>
        <p className="text-gray-600">
          Overview of your calling performance and metrics
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(callStats.totalCalls || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All time calls made</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Successful Calls
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(callStats.completedCalls || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {successRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transfers</CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {(callStats.transferredCalls || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {transferRate.toFixed(1)}% transfer rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Success + transfers</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Call Performance</CardTitle>
            <CardDescription>Breakdown of call outcomes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completed Calls</span>
                <span>
                  {callStats.completedCalls || 0} ({successRate.toFixed(1)}%)
                </span>
              </div>
              <Progress value={successRate} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Transferred Calls</span>
                <span>
                  {callStats.transferredCalls || 0} ({transferRate.toFixed(1)}%)
                </span>
              </div>
              <Progress value={transferRate} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Failed Calls</span>
                <span>
                  {callStats.failedCalls || 0} (
                  {(
                    ((callStats.failedCalls || 0) /
                      (callStats.totalCalls || 1)) *
                      100 || 0
                  ).toFixed(1)}
                  %)
                </span>
              </div>
              <Progress
                value={
                  ((callStats.failedCalls || 0) / (callStats.totalCalls || 1)) *
                    100 || 0
                }
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call Duration</CardTitle>
            <CardDescription>
              Average call duration and timing metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Average Duration
                </p>
                <p className="text-2xl font-bold">
                  {Math.floor(callStats.averageDuration / 60)}m{" "}
                  {callStats.averageDuration % 60}s
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Calls
                </p>
                <p className="text-2xl font-bold">
                  {callStats.initiatedCalls || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Efficiency Score
                </p>
                <p className="text-2xl font-bold">
                  {conversionRate.toFixed(0)}/100
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Performance Summary
          </CardTitle>
          <CardDescription>
            Key performance indicators for your calling campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">
                {callStats.completedCalls || 0}
              </p>
              <p className="text-sm text-gray-600">Successful Connections</p>
            </div>

            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <ArrowRight className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-600">
                {callStats.transferredCalls || 0}
              </p>
              <p className="text-sm text-gray-600">Qualified Transfers</p>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-600">
                {conversionRate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600">Overall Conversion</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
