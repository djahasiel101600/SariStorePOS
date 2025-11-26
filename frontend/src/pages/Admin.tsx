// src/pages/Admin.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useUsers,
  useActiveShifts,
  useShifts,
  useEmployeePerformance,
  useCreateUser,
  useUpdateUser,
} from "@/hooks/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Users,
  Clock,
  TrendingUp,
  Activity,
  DollarSign,
  UserPlus,
  Edit,
  CheckCircle2,
  XCircle,
  Loader2,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorHandling";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import type { User, Shift } from "@/types";

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [startDate, setStartDate] = useState<string>("");

  // Check authorization
  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      toast.error("Access denied. Admin or Manager role required.");
      navigate("/");
    }
  }, [user, navigate]);
  const [endDate, setEndDate] = useState<string>("");
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: activeShifts, isLoading: activeShiftsLoading } =
    useActiveShifts();
  const { data: shifts, isLoading: shiftsLoading } = useShifts(
    startDate,
    endDate
  );
  const { data: performance, isLoading: performanceLoading } =
    useEmployeePerformance(startDate, endDate);

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  const handleDateFilter = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setIsUserDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
  };

  const handleViewShift = (shift: Shift) => {
    setSelectedShift(shift);
    setIsShiftDialogOpen(true);
  };

  // Calculate summary stats
  const totalRevenue =
    performance?.reduce((sum, p) => sum + Number(p.total_revenue), 0) || 0;
  const totalTransactions =
    performance?.reduce((sum, p) => sum + p.total_sales, 0) || 0;
  const avgPerEmployee = performance?.length
    ? totalRevenue / performance.length
    : 0;

  // Ensure users is always an array
  const usersList = Array.isArray(users) ? users : [];

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Admin Dashboard
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
            Manage users, shifts, and view employee performance
          </p>
        </div>
        <Button
          onClick={handleCreateUser}
          className="w-full sm:w-auto"
          size="sm"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Active Shifts Monitor */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Activity className="h-5 w-5 text-green-600" />
            Active Shifts
            {activeShifts && activeShifts.length > 0 && (
              <Badge variant="default" className="ml-2">
                {activeShifts.length} Active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {activeShiftsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : !activeShifts || activeShifts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm md:text-base">No active shifts</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeShifts.map((shift) => (
                <Card key={shift.id} className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-lg">
                          {shift.user_name}
                        </p>
                        <p className="text-xs text-gray-600">
                          Started: {formatDate(shift.start_time)}
                        </p>
                      </div>
                      <Badge variant="default" className="bg-green-600">
                        Active
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Sales:</span>
                        <span className="font-semibold">
                          {shift.sales_count}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cash Sales:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(shift.cash_sales || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Credit Sales:</span>
                        <span className="font-semibold text-orange-600">
                          {formatCurrency(shift.credit_sales || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Utang Payments:</span>
                        <span className="font-semibold text-blue-600">
                          {formatCurrency(shift.utang_payments_received || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-600">Total Revenue:</span>
                        <span className="font-semibold text-blue-600">
                          {formatCurrency(shift.total_sales)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Opening Cash:</span>
                        <span>{formatCurrency(shift.opening_cash)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Expected Cash:</span>
                        <span className="font-semibold">
                          {formatCurrency(shift.expected_cash || 0)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => handleViewShift(shift)}
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="shifts">Shift History</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Card>
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                      Total Revenue
                    </p>
                    <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1 truncate">
                      {formatCurrency(totalRevenue)}
                    </p>
                  </div>
                  <div className="p-2 md:p-3 bg-green-100 rounded-full shrink-0">
                    <DollarSign className="h-4 w-4 md:h-6 md:w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                      Total Sales
                    </p>
                    <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                      {totalTransactions}
                    </p>
                  </div>
                  <div className="p-2 md:p-3 bg-blue-100 rounded-full shrink-0">
                    <BarChart3 className="h-4 w-4 md:h-6 md:w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                      Active Staff
                    </p>
                    <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">
                      {usersList.filter((u) => u.is_active).length || 0}
                    </p>
                  </div>
                  <div className="p-2 md:p-3 bg-purple-100 rounded-full shrink-0">
                    <Users className="h-4 w-4 md:h-6 md:w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium text-gray-600 truncate">
                      Avg/Employee
                    </p>
                    <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1 truncate">
                      {formatCurrency(avgPerEmployee)}
                    </p>
                  </div>
                  <div className="p-2 md:p-3 bg-amber-100 rounded-full shrink-0">
                    <TrendingUp className="h-4 w-4 md:h-6 md:w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Date Filter */}
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Label className="text-sm font-medium">Period:</Label>
                <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:w-auto">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDateFilter(7)}
                    >
                      7 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDateFilter(30)}
                    >
                      30 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                    >
                      All
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee Performance Table */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base md:text-lg">
                Employee Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              {performanceLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : !performance || performance.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No performance data</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Shifts</TableHead>
                        <TableHead>Sales</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Avg Sale</TableHead>
                        <TableHead>Last Shift</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance.map((emp) => (
                        <TableRow key={emp.user_id}>
                          <TableCell className="font-medium">
                            {emp.user_name}
                          </TableCell>
                          <TableCell>{emp.shift_count}</TableCell>
                          <TableCell>{emp.total_sales}</TableCell>
                          <TableCell className="text-green-600 font-semibold">
                            {formatCurrency(emp.total_revenue)}
                          </TableCell>
                          <TableCell>{formatCurrency(emp.avg_sale)}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {emp.last_shift
                              ? formatDate(emp.last_shift)
                              : "Never"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shift History Tab */}
        <TabsContent value="shifts" className="space-y-4">
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base md:text-lg">
                Shift History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              {shiftsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : !shifts || shifts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No shift history</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Sales</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Cash Diff</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts.map((shift) => (
                        <TableRow key={shift.id}>
                          <TableCell className="font-medium">
                            {shift.user_name}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(shift.start_time)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {shift.end_time ? formatDate(shift.end_time) : "-"}
                          </TableCell>
                          <TableCell>{shift.sales_count}</TableCell>
                          <TableCell className="text-green-600 font-semibold">
                            {formatCurrency(shift.total_sales)}
                          </TableCell>
                          <TableCell>
                            {shift.cash_difference !== null ? (
                              <span
                                className={
                                  shift.cash_difference === 0
                                    ? "text-green-600"
                                    : shift.cash_difference > 0
                                      ? "text-blue-600"
                                      : "text-red-600"
                                }
                              >
                                {formatCurrency(shift.cash_difference)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {shift.end_time ? (
                              <Badge variant="outline">Closed</Badge>
                            ) : (
                              <Badge variant="default">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewShift(shift)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base md:text-lg">
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : usersList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersList.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.username}
                          </TableCell>
                          <TableCell>
                            {user.first_name} {user.last_name}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.role === "admin" || user.role === "manager"
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {user.role === "admin" && "Administrator"}
                              {user.role === "manager" && "Manager"}
                              {user.role === "inventory_manager" &&
                                "Inventory Manager"}
                              {user.role === "cashier" && "Cashier"}
                              {!user.role && "No Role"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.is_active ? (
                              <Badge
                                variant="outline"
                                className="text-green-600 border-green-600"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-red-600 border-red-600"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(user.date_joined)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Dialog */}
      <UserDialog
        isOpen={isUserDialogOpen}
        onClose={() => setIsUserDialogOpen(false)}
        user={selectedUser}
        onSave={(userData) => {
          if (selectedUser) {
            updateUserMutation.mutate(
              { id: selectedUser.id, ...userData },
              {
                onSuccess: () => {
                  toast.success("User updated successfully");
                  setIsUserDialogOpen(false);
                },
                onError: (error: unknown) => {
                  console.error("Update user error:", error);
                  toast.error(getErrorMessage(error));
                },
              }
            );
          } else {
            createUserMutation.mutate(userData as any, {
              onSuccess: () => {
                toast.success("User created successfully");
                setIsUserDialogOpen(false);
              },
              onError: (error: unknown) => {
                console.error("Create user error:", error);
                toast.error(getErrorMessage(error));
              },
            });
          }
        }}
      />

      {/* Shift Details Dialog */}
      <ShiftDetailsDialog
        isOpen={isShiftDialogOpen}
        onClose={() => setIsShiftDialogOpen(false)}
        shift={selectedShift}
      />
    </div>
  );
};

// User Dialog Component
interface UserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (userData: Partial<User> & { password?: string }) => void;
}

const UserDialog: React.FC<UserDialogProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    first_name: "",
    last_name: "",
    is_staff: false,
    is_active: true,
    role: "cashier" as string,
  });

  React.useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: "",
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_staff: user.is_staff,
        is_active: user.is_active,
        role: user.role || "cashier",
      });
    } else {
      setFormData({
        username: "",
        password: "",
        email: "",
        first_name: "",
        last_name: "",
        is_staff: false,
        is_active: true,
        role: "cashier",
      });
    }
  }, [user, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "Create User"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
            />
          </div>

          {!user && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">Cashier</SelectItem>
                <SelectItem value="inventory_manager">
                  Inventory Manager
                </SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_staff">Admin Role</Label>
            <Switch
              id="is_staff"
              checked={formData.is_staff}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_staff: checked })
              }
            />
          </div>

          {user && (
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{user ? "Update" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Shift Details Dialog Component
interface ShiftDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift | null;
}

const ShiftDetailsDialog: React.FC<ShiftDetailsDialogProps> = ({
  isOpen,
  onClose,
  shift,
}) => {
  if (!shift) return null;

  const duration = shift.end_time
    ? Math.round(
        (new Date(shift.end_time).getTime() -
          new Date(shift.start_time).getTime()) /
          (1000 * 60 * 60)
      )
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shift Details - {shift.user_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Shift ID</p>
              <p className="font-semibold">#{shift.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              {shift.end_time ? (
                <Badge variant="outline">Closed</Badge>
              ) : (
                <Badge variant="default" className="bg-green-600">
                  Active
                </Badge>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Start Time</p>
              <p>{formatDate(shift.start_time)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">End Time</p>
              <p>{shift.end_time ? formatDate(shift.end_time) : "Ongoing"}</p>
            </div>
            {duration !== null && (
              <div>
                <p className="text-sm font-medium text-gray-600">Duration</p>
                <p>{duration} hours</p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Sales Performance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold">{shift.sales_count}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(shift.total_sales)}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Cash Management</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Opening Cash:</span>
                <span className="font-semibold">
                  {formatCurrency(shift.opening_cash)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Expected Cash:</span>
                <span className="font-semibold">
                  {shift.expected_cash !== null
                    ? formatCurrency(shift.expected_cash)
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Closing Cash:</span>
                <span className="font-semibold">
                  {shift.closing_cash !== null
                    ? formatCurrency(shift.closing_cash)
                    : "-"}
                </span>
              </div>
              {shift.cash_difference !== null && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Cash Difference:</span>
                  <span
                    className={`font-bold ${
                      shift.cash_difference === 0
                        ? "text-green-600"
                        : shift.cash_difference > 0
                          ? "text-blue-600"
                          : "text-red-600"
                    }`}
                  >
                    {formatCurrency(shift.cash_difference)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {shift.notes && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{shift.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Admin;
