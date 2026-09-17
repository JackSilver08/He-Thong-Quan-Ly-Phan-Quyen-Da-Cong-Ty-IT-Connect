package exporter

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"github.com/it-connect/access-management/internal/domain"
	"github.com/xuri/excelize/v2"
)

// Header style: Navy background, white bold text, centered
func createHeaderStyle(f *excelize.File) (int, error) {
	return f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Color: "#FFFFFF",
			Size:  11,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#1E3A8A"}, // Deep Navy
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
			WrapText:   true,
		},
		Border: []excelize.Border{
			{Type: "left", Color: "#94A3B8", Style: 1},
			{Type: "top", Color: "#94A3B8", Style: 1},
			{Type: "bottom", Color: "#94A3B8", Style: 1},
			{Type: "right", Color: "#94A3B8", Style: 1},
		},
	})
}

// Data row border style
func createDataStyle(f *excelize.File) (int, error) {
	return f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "#CBD5E1", Style: 1},
			{Type: "top", Color: "#CBD5E1", Style: 1},
			{Type: "bottom", Color: "#CBD5E1", Style: 1},
			{Type: "right", Color: "#CBD5E1", Style: 1},
		},
		Alignment: &excelize.Alignment{
			Vertical: "center",
		},
	})
}

func createCenterStyle(f *excelize.File) (int, error) {
	return f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "#CBD5E1", Style: 1},
			{Type: "top", Color: "#CBD5E1", Style: 1},
			{Type: "bottom", Color: "#CBD5E1", Style: 1},
			{Type: "right", Color: "#CBD5E1", Style: 1},
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
	})
}

func setRowHeightAndCols(f *excelize.File, sheet string, cols map[string]float64) {
	_ = f.SetRowHeight(sheet, 1, 30)
	for col, width := range cols {
		_ = f.SetColWidth(sheet, col, col, width)
	}
}

func formatDate(t *time.Time) string {
	if t == nil {
		return "—"
	}
	return t.Format("02/01/2006")
}

// ExportUsers exports users to an Excel spreadsheet
func ExportUsers(users []domain.User) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Nhân sự"
	f.SetSheetName("Sheet1", sheet)

	hdrStyle, _ := createHeaderStyle(f)
	dataStyle, _ := createDataStyle(f)
	centerStyle, _ := createCenterStyle(f)

	headers := []string{"STT", "Mã NV", "Họ và tên", "Tên đăng nhập", "Email", "Số điện thoại", "Công ty", "Phòng ban", "Vai trò", "Trạng thái", "Ngày vào làm"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
		_ = f.SetCellStyle(sheet, cell, cell, hdrStyle)
	}

	for rowIdx, u := range users {
		r := rowIdx + 2
		dept := ""
		if u.DepartmentName != nil {
			dept = *u.DepartmentName
		}
		statusLabel := u.Status
		switch u.Status {
		case "ACTIVE":
			statusLabel = "Đang làm việc"
		case "RESIGNED":
			statusLabel = "Đã nghỉ việc"
		case "DISABLED":
			statusLabel = "Vô hiệu hoá"
		}

		vals := []any{rowIdx + 1, u.EmployeeCode, u.FullName, u.Username, u.Email, u.Phone, u.CompanyName, dept, u.Role, statusLabel, formatDate(u.JoinedAt)}
		for colIdx, val := range vals {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, r)
			_ = f.SetCellValue(sheet, cell, val)
			if colIdx == 0 || colIdx == 1 || colIdx == 8 || colIdx == 9 || colIdx == 10 {
				_ = f.SetCellStyle(sheet, cell, cell, centerStyle)
			} else {
				_ = f.SetCellStyle(sheet, cell, cell, dataStyle)
			}
		}
		_ = f.SetRowHeight(sheet, r, 22)
	}

	setRowHeightAndCols(f, sheet, map[string]float64{
		"A": 6, "B": 14, "C": 26, "D": 18, "E": 26, "F": 16, "G": 22, "H": 20, "I": 15, "J": 16, "K": 15,
	})

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// ExportProjects exports projects to an Excel spreadsheet
func ExportProjects(projects []domain.Project) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Dự án"
	f.SetSheetName("Sheet1", sheet)

	hdrStyle, _ := createHeaderStyle(f)
	dataStyle, _ := createDataStyle(f)
	centerStyle, _ := createCenterStyle(f)

	headers := []string{"STT", "Mã dự án", "Tên dự án", "Công ty", "Đường dẫn File Server", "Trạng thái", "Ngày bắt đầu", "Ngày kết thúc"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
		_ = f.SetCellStyle(sheet, cell, cell, hdrStyle)
	}

	for rowIdx, p := range projects {
		r := rowIdx + 2
		statusLabel := p.Status
		if p.Status == "ACTIVE" {
			statusLabel = "Hoạt động"
		}
		vals := []any{rowIdx + 1, p.Code, p.Name, p.CompanyName, p.FolderPath, statusLabel, formatDate(p.StartDate), formatDate(p.EndDate)}
		for colIdx, val := range vals {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, r)
			_ = f.SetCellValue(sheet, cell, val)
			if colIdx == 0 || colIdx == 1 || colIdx == 5 || colIdx == 6 || colIdx == 7 {
				_ = f.SetCellStyle(sheet, cell, cell, centerStyle)
			} else {
				_ = f.SetCellStyle(sheet, cell, cell, dataStyle)
			}
		}
		_ = f.SetRowHeight(sheet, r, 22)
	}

	setRowHeightAndCols(f, sheet, map[string]float64{
		"A": 6, "B": 15, "C": 30, "D": 22, "E": 40, "F": 15, "G": 15, "H": 15,
	})

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// ExportResigned exports resigned users along with replacement info
func ExportResigned(users []domain.User, userMap map[string]domain.User, accessCountMap map[string]int) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Nghỉ việc"
	f.SetSheetName("Sheet1", sheet)

	hdrStyle, _ := createHeaderStyle(f)
	dataStyle, _ := createDataStyle(f)
	centerStyle, _ := createCenterStyle(f)

	headers := []string{"STT", "Mã NV", "Họ và tên", "Công ty", "Phòng ban", "Ngày nghỉ việc", "Người thay thế", "Mã NV thay thế", "Quyền chưa thu hồi", "Ghi chú bàn giao"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
		_ = f.SetCellStyle(sheet, cell, cell, hdrStyle)
	}

	idx := 0
	for _, u := range users {
		if u.Status != "RESIGNED" {
			continue
		}
		r := idx + 2
		dept := ""
		if u.DepartmentName != nil {
			dept = *u.DepartmentName
		}
		repName, repCode := "Chưa chỉ định", "—"
		if u.ReplacementID != nil && *u.ReplacementID != "" {
			if rep, ok := userMap[*u.ReplacementID]; ok {
				repName = rep.FullName
				repCode = rep.EmployeeCode
			}
		}
		acc := fmt.Sprintf("%d dự án", accessCountMap[u.ID])
		if accessCountMap[u.ID] == 0 {
			acc = "Đã thu hồi hết"
		}

		vals := []any{idx + 1, u.EmployeeCode, u.FullName, u.CompanyName, dept, formatDate(u.ResignedAt), repName, repCode, acc, u.Notes}
		for colIdx, val := range vals {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, r)
			_ = f.SetCellValue(sheet, cell, val)
			if colIdx == 0 || colIdx == 1 || colIdx == 5 || colIdx == 7 || colIdx == 8 {
				_ = f.SetCellStyle(sheet, cell, cell, centerStyle)
			} else {
				_ = f.SetCellStyle(sheet, cell, cell, dataStyle)
			}
		}
		_ = f.SetRowHeight(sheet, r, 22)
		idx++
	}

	setRowHeightAndCols(f, sheet, map[string]float64{
		"A": 6, "B": 14, "C": 26, "D": 22, "E": 20, "F": 15, "G": 24, "H": 15, "I": 20, "J": 35,
	})

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// ExportPermissionMatrix creates a 2D matrix of Employees x Projects with R, W, X symbols
func ExportPermissionMatrix(companyName string, users []domain.User, projects []domain.Project, permissions []domain.Permission) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Ma trận phân quyền"
	f.SetSheetName("Sheet1", sheet)

	hdrStyle, _ := createHeaderStyle(f)
	dataStyle, _ := createDataStyle(f)
	centerStyle, _ := createCenterStyle(f)

	// Custom styles for R, W, X
	styleR, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#0369A1"}, // Sky Blue text
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E0F2FE"}, Pattern: 1},
		Border: []excelize.Border{
			{Type: "left", Color: "#CBD5E1", Style: 1}, {Type: "top", Color: "#CBD5E1", Style: 1},
			{Type: "bottom", Color: "#CBD5E1", Style: 1}, {Type: "right", Color: "#CBD5E1", Style: 1},
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	styleW, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#1D4ED8"}, // Blue text
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#DBEAFE"}, Pattern: 1},
		Border: []excelize.Border{
			{Type: "left", Color: "#CBD5E1", Style: 1}, {Type: "top", Color: "#CBD5E1", Style: 1},
			{Type: "bottom", Color: "#CBD5E1", Style: 1}, {Type: "right", Color: "#CBD5E1", Style: 1},
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	styleX, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#64748B"}, // Gray text
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#F1F5F9"}, Pattern: 1},
		Border: []excelize.Border{
			{Type: "left", Color: "#CBD5E1", Style: 1}, {Type: "top", Color: "#CBD5E1", Style: 1},
			{Type: "bottom", Color: "#CBD5E1", Style: 1}, {Type: "right", Color: "#CBD5E1", Style: 1},
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	// Build map: (user_id, project_id) -> level
	permMap := make(map[string]string)
	for _, p := range permissions {
		if p.ResourceID == nil { // Project level
			permMap[p.UserID+"|"+p.ProjectID] = p.Level
		}
	}

	// Base Headers
	baseHeaders := []string{"STT", "Mã NV", "Họ và tên", "Phòng ban", "Trạng thái"}
	for i, h := range baseHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
		_ = f.SetCellStyle(sheet, cell, cell, hdrStyle)
	}

	// Project Headers (columns 6, 7, ...)
	for j, proj := range projects {
		colIdx := len(baseHeaders) + j + 1
		cell, _ := excelize.CoordinatesToCellName(colIdx, 1)
		headerText := fmt.Sprintf("%s\n%s", proj.Code, proj.Name)
		_ = f.SetCellValue(sheet, cell, headerText)
		_ = f.SetCellStyle(sheet, cell, cell, hdrStyle)
		colLetter, _ := excelize.ColumnNumberToName(colIdx)
		_ = f.SetColWidth(sheet, colLetter, colLetter, 16)
	}

	_ = f.SetRowHeight(sheet, 1, 40)

	// Rows: Users
	for rIdx, u := range users {
		r := rIdx + 2
		dept := ""
		if u.DepartmentName != nil {
			dept = *u.DepartmentName
		}
		statusLabel := "Đang làm việc"
		if u.Status == "RESIGNED" {
			statusLabel = "Đã nghỉ việc"
		}

		baseVals := []any{rIdx + 1, u.EmployeeCode, u.FullName, dept, statusLabel}
		for colIdx, val := range baseVals {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, r)
			_ = f.SetCellValue(sheet, cell, val)
			if colIdx == 0 || colIdx == 1 || colIdx == 4 {
				_ = f.SetCellStyle(sheet, cell, cell, centerStyle)
			} else {
				_ = f.SetCellStyle(sheet, cell, cell, dataStyle)
			}
		}

		// Project columns
		for j, proj := range projects {
			colIdx := len(baseHeaders) + j + 1
			cell, _ := excelize.CoordinatesToCellName(colIdx, r)

			level := permMap[u.ID+"|"+proj.ID]
			symbol := "-"
			cellStyle := centerStyle

			switch strings.ToUpper(level) {
			case "READ", "R":
				symbol = "R"
				cellStyle = styleR
			case "WRITE", "W":
				symbol = "W"
				cellStyle = styleW
			case "NONE", "X":
				symbol = "X"
				cellStyle = styleX
			}

			_ = f.SetCellValue(sheet, cell, symbol)
			_ = f.SetCellStyle(sheet, cell, cell, cellStyle)
		}
		_ = f.SetRowHeight(sheet, r, 22)
	}

	setRowHeightAndCols(f, sheet, map[string]float64{
		"A": 6, "B": 14, "C": 26, "D": 20, "E": 15,
	})

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
