package main

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// 数据结构定义
type DatabaseItem struct {
	ID           int                    `json:"id"`
	RandomNumber int                    `json:"randomNumber"`
	Message      string                 `json:"message"`
	Timestamp    string                 `json:"timestamp"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type BatchItem struct {
	ID       int      `json:"id" validate:"required"`
	Value    float64  `json:"value" validate:"required"`
	Name     string   `json:"name" validate:"required"`
	Category string   `json:"category,omitempty"`
	Tags     []string `json:"tags,omitempty"`
}

type BatchRequest struct {
	Items     []BatchItem `json:"items" validate:"required,dive"`
	Operation string      `json:"operation" validate:"required,oneof=sum average count min max median"`
}

type BatchResult struct {
	Operation      string  `json:"operation"`
	Result         float64 `json:"result"`
	Count          int     `json:"count"`
	ProcessingTime float64 `json:"processingTime"`
	Timestamp      string  `json:"timestamp"`
}

type User struct {
	Name        string            `json:"name" validate:"required,min=2,max=50"`
	Phone       string            `json:"phone" validate:"required,regexp=^1[3-9]\\d{9}$"`
	Age         int               `json:"age" validate:"required,min=0,max=120"`
	Active      bool              `json:"active" validate:"required"`
	Tags        []string          `json:"tags" validate:"required"`
	Preferences map[string]string `json:"preferences" validate:"required"`
}

type ValidateRequest struct {
	User     User              `json:"user" validate:"required"`
	Metadata map[string]string `json:"metadata" validate:"required"`
}

type ValidateResponse struct {
	Success         bool                   `json:"success"`
	ValidatedBody   ValidateRequest        `json:"validatedBody"`
	ValidatedQuery  map[string]interface{} `json:"validatedQuery"`
	Timestamp       string                 `json:"timestamp"`
}

// 全局验证器
var validate *validator.Validate

// 工具函数
func parseQueryParam(c *gin.Context, key string, defaultValue int) int {
	if value := c.Query(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			return min(parsed, 1000) // 限制最大值
		}
	}
	return defaultValue
}

func simulateDatabaseQuery(queries int) []DatabaseItem {
	count := min(max(queries, 1), 1000)
	results := make([]DatabaseItem, count)
	now := time.Now().Format(time.RFC3339)

	for i := 0; i < count; i++ {
		results[i] = DatabaseItem{
			ID:           i + 1,
			RandomNumber: rand.Intn(10000) + 1,
			Message:      fmt.Sprintf("Database record %d", i+1),
			Timestamp:    now,
			Metadata: map[string]interface{}{
				"version":  "1.0.0",
				"source":   "simulated_db",
				"index":    i,
				"checksum": fmt.Sprintf("checksum_%d_%d", i, time.Now().UnixNano()),
			},
		}
	}

	return results
}

func simulateDatabaseUpdate(queries int) []DatabaseItem {
	count := min(max(queries, 1), 500)
	results := make([]DatabaseItem, count)
	now := time.Now().Format(time.RFC3339)

	for i := 0; i < count; i++ {
		results[i] = DatabaseItem{
			ID:           i + 1,
			RandomNumber: rand.Intn(10000) + 1,
			Message:      fmt.Sprintf("Updated record %d at %s", i+1, now),
			Timestamp:    now,
			Metadata: map[string]interface{}{
				"operation":     "UPDATE",
				"affectedRows":  1,
				"executionTime": rand.Float64()*10 + 1,
				"transactionId": fmt.Sprintf("tx_%d_%d", time.Now().UnixNano(), i),
			},
		}
	}

	return results
}

func createNestedObject(currentDepth, maxDepth int, objectType string) interface{} {
	if currentDepth >= maxDepth {
		if objectType == "array" {
			return []interface{}{}
		}
		return "leaf"
	}

	if objectType == "array" {
		return []interface{}{
			currentDepth,
			fmt.Sprintf("array-data-%d", currentDepth),
			createNestedObject(currentDepth+1, maxDepth, "object"),
			rand.Float64() * 1000,
			time.Now().Format(time.RFC3339),
		}
	}

	arrayItems := make([]map[string]interface{}, rand.Intn(10)+1)
	for i := range arrayItems {
		arrayItems[i] = map[string]interface{}{
			"index": i,
			"value": rand.Float64() * 100,
			"label": fmt.Sprintf("item-%d", i),
		}
	}

	nextType := "object"
	if rand.Float64() > 0.5 {
		nextType = "array"
	}

	return map[string]interface{}{
		"level":     currentDepth,
		"data":      fmt.Sprintf("nested-data-%d", currentDepth),
		"nested":    createNestedObject(currentDepth+1, maxDepth, nextType),
		"array":     arrayItems,
		"timestamp": time.Now().Format(time.RFC3339),
		"metadata": map[string]interface{}{
			"depth":      currentDepth,
			"complexity": int(math.Pow(2, float64(currentDepth))),
			"generated":  time.Now().UnixNano(),
		},
	}
}

func simulateComplexJsonSerialization(depth int) interface{} {
	maxDepth := min(max(depth, 1), 10)
	return createNestedObject(0, maxDepth, "object")
}

func simulateBatchProcessing(req BatchRequest) (*BatchResult, error) {
	startTime := time.Now()
	items := req.Items

	if len(items) == 0 {
		return nil, fmt.Errorf("items array cannot be empty")
	}

	if len(items) > 10000 {
		return nil, fmt.Errorf("items array too large (max 10,000)")
	}

	var result float64

	switch req.Operation {
	case "sum":
		for _, item := range items {
			result += item.Value
		}
	case "average":
		sum := 0.0
		for _, item := range items {
			sum += item.Value
		}
		result = sum / float64(len(items))
	case "count":
		result = float64(len(items))
	case "min":
		result = items[0].Value
		for _, item := range items[1:] {
			if item.Value < result {
				result = item.Value
			}
		}
	case "max":
		result = items[0].Value
		for _, item := range items[1:] {
			if item.Value > result {
				result = item.Value
			}
		}
	case "median":
		values := make([]float64, len(items))
		for i, item := range items {
			values[i] = item.Value
		}
		// 简单排序
		for i := 0; i < len(values); i++ {
			for j := i + 1; j < len(values); j++ {
				if values[i] > values[j] {
					values[i], values[j] = values[j], values[i]
				}
			}
		}
		mid := len(values) / 2
		if len(values)%2 == 0 {
			result = (values[mid-1] + values[mid]) / 2
		} else {
			result = values[mid]
		}
	default:
		return nil, fmt.Errorf("unknown operation: %s", req.Operation)
	}

	processingTime := float64(time.Since(startTime).Nanoseconds()) / 1000000 // 转换为毫秒

	return &BatchResult{
		Operation:      req.Operation,
		Result:         math.Round(result*1000000) / 1000000, // 保留6位小数
		Count:          len(items),
		ProcessingTime: math.Round(processingTime*1000) / 1000, // 保留3位小数
		Timestamp:      time.Now().Format(time.RFC3339),
	}, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func main() {
	// 初始化验证器
	validate = validator.New()
	
	// 设置随机种子
	rand.Seed(time.Now().UnixNano())

	// 设置Gin模式
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// 基础路由
	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "Hello Gin!")
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"framework": "gin",
		})
	})

	// TechEmpower 风格测试接口
	r.GET("/techempower/json", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Hello, World!",
		})
	})

	r.GET("/techempower/plaintext", func(c *gin.Context) {
		c.String(http.StatusOK, "Hello, World!")
	})

	r.GET("/techempower/db", func(c *gin.Context) {
		queries := parseQueryParam(c, "queries", 1)
		results := simulateDatabaseQuery(queries)
		c.JSON(http.StatusOK, results)
	})

	r.GET("/techempower/updates", func(c *gin.Context) {
		queries := parseQueryParam(c, "queries", 1)
		results := simulateDatabaseUpdate(queries)
		c.JSON(http.StatusOK, results)
	})

	r.GET("/techempower/complex-json", func(c *gin.Context) {
		depth := parseQueryParam(c, "depth", 3)
		result := simulateComplexJsonSerialization(depth)
		c.JSON(http.StatusOK, result)
	})

	// 批量数据处理测试
	r.POST("/techempower/batch-process", func(c *gin.Context) {
		var req BatchRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid JSON format",
			})
			return
		}

		if err := validate.Struct(req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Validation failed",
			})
			return
		}

		result, err := simulateBatchProcessing(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, result)
	})

	// Schema 验证接口
	r.POST("/schema/validate", func(c *gin.Context) {
		var req ValidateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid JSON format",
			})
			return
		}

		if err := validate.Struct(req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Validation failed",
			})
			return
		}

		// 获取查询参数
		page := c.Query("page")
		limit := c.Query("limit")

		response := ValidateResponse{
			Success:       true,
			ValidatedBody: req,
			ValidatedQuery: map[string]interface{}{
				"page":  page,
				"limit": limit,
			},
			Timestamp: time.Now().Format(time.RFC3339),
		}

		c.JSON(http.StatusOK, response)
	})

	// 启动服务器
	fmt.Println("🚀 Gin is running at http://localhost:3000")
	fmt.Println("📊 Available benchmark endpoints:")
	fmt.Println("=== Schema 验证接口 ===")
	fmt.Println("  POST /schema/validate               - 综合验证接口 (使用 validator 包)")
	fmt.Println()
	fmt.Println("=== TechEmpower 风格测试接口 ===")
	fmt.Println("  GET  /techempower/json                          - JSON序列化测试")
	fmt.Println("  GET  /techempower/plaintext                     - 纯文本测试")
	fmt.Println("  GET  /techempower/db                            - 数据库查询测试")
	fmt.Println("  GET  /techempower/updates                       - 数据库更新测试")
	fmt.Println("  GET  /techempower/complex-json                  - 复杂对象序列化测试")
	fmt.Println("  POST /techempower/batch-process                 - 批量数据处理测试 (使用 validator 包)")

	r.Run(":3000")
}