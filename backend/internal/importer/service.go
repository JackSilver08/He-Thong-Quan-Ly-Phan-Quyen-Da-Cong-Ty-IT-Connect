package importer

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/it-connect/access-management/internal/auth"
	"github.com/it-connect/access-management/internal/domain"
	"github.com/it-connect/access-management/internal/legacyimport"
	"github.com/it-connect/access-management/internal/repository"
	"github.com/xuri/excelize/v2"
)

type ImportUserRow struct {
	EmployeeCode   string            `json:"employee_code"`
	FullName       string            `json:"full_name"`
	Username       string            `json:"username"`
	Email          string            `json:"email"`
	Phone          string            `json:"phone"`
	DepartmentName string            `json:"department_name"`
	Role           string            `json:"role"`
	Status         string            `json:"status"`
	JoinedDate     string            `json:"joined_date"`
	Notes          string            `json:"notes"`
	Grants         map[string]string `json:"grants"` // projectCode/Name -> level (READ, WRITE, NONE)
}

type ImportPreview struct {
	TotalUsers      int             `json:"total_users"`
	ValidUsers      []ImportUserRow `json:"users"`
	NewDepartments  []string        `json:"new_departments"`
	DetectedProjects []string       `json:"detected_projects"`
	TotalGrants     int             `json:"total_grants"`
	Warnings        []string        `json:"warnings"`
	Errors          []string        `json:"errors"`
}

// ParseAndPreviewExcel parses the uploaded workbook and builds a validation preview
func ParseAndPreviewExcel(r io.Reader) (*ImportPreview, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, fmt.Errorf("không mở được file Excel: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("file Excel không có sheet nào")
	}

	// Determine active sheet: prioritize "Sonacons", "Nhân sự", or first sheet
	activeSheet := sheets[0]
	for _, s := range sheets {
		name := strings.ToLower(s)
		if name == "sonacons" || name == "nhan su" || name == "nhân sự" || name == "users" {
			activeSheet = s
			break
		}
	}

	rows, err := f.GetRows(activeSheet)
	if err != nil {
		return nil, fmt.Errorf("không đọc được dữ liệu sheet %s: %w", activeSheet, err)
	}

	preview := &ImportPreview{
		ValidUsers:       []ImportUserRow{},
		NewDepartments:   []string{},
		DetectedProjects: []string{},
		Warnings:         []string{},
		Errors:           []string{},
	}

	if len(rows) < 2 {
		preview.Warnings = append(preview.Warnings, "Sheet không có đủ dữ liệu hàng tiêu đề và nội dung")
		return preview, nil
	}

	// Find the header row index (usually row 0 or row 1 or row 2)
	headerRowIdx := -1
	for rIdx, row := range rows {
		for _, cell := range row {
			cellClean := strings.ToLower(strings.TrimSpace(cell))
			if strings.Contains(cellClean, "họ và tên") || strings.Contains(cellClean, "họ tên") || strings.Contains(cellClean, "tên nv") || strings.Contains(cellClean, "username") {
				headerRowIdx = rIdx
				break
			}
		}
		if headerRowIdx != -1 {
			break
		}
	}

	if headerRowIdx == -1 {
		headerRowIdx = 0 // fallback
	}

	headers := rows[headerRowIdx]
	colMap := make(map[string]int)
	projectCols := make(map[int]string) // colIdx -> project/folder name

	for cIdx, h := range headers {
		cleanHeader := strings.TrimSpace(h)
		lower := strings.ToLower(cleanHeader)
		if strings.Contains(lower, "mã nv") || strings.Contains(lower, "manv") || strings.Contains(lower, "mã") {
			colMap["code"] = cIdx
		} else if strings.Contains(lower, "họ") || strings.Contains(lower, "tên") || strings.Contains(lower, "name") {
			if _, exists := colMap["name"]; !exists {
				colMap["name"] = cIdx
			}
		} else if strings.Contains(lower, "user") || strings.Contains(lower, "đăng nhập") {
			colMap["username"] = cIdx
		} else if strings.Contains(lower, "email") {
			colMap["email"] = cIdx
		} else if strings.Contains(lower, "thoại") || strings.Contains(lower, "phone") || strings.Contains(lower, "sđt") {
			colMap["phone"] = cIdx
		} else if strings.Contains(lower, "phòng") || strings.Contains(lower, "bộ phận") || strings.Contains(lower, "dept") {
			colMap["department"] = cIdx
		} else if strings.Contains(lower, "vai trò") || strings.Contains(lower, "chức vụ") || strings.Contains(lower, "role") {
			colMap["role"] = cIdx
		} else if strings.Contains(lower, "ghi chú") || strings.Contains(lower, "note") {
			colMap["notes"] = cIdx
		} else if cIdx > 3 && cleanHeader != "" {
			// Could be a project or folder column (like in Sonacons sheet)
			projectCols[cIdx] = cleanHeader
			preview.DetectedProjects = append(preview.DetectedProjects, cleanHeader)
		}
	}

	deptSet := make(map[string]struct{})
	userCodeSet := make(map[string]struct{})

	for rIdx := headerRowIdx + 1; rIdx < len(rows); rIdx++ {
		row := rows[rIdx]
		if len(row) == 0 {
			continue
		}

		getVal := func(key string) string {
			idx, ok := colMap[key]
			if !ok || idx >= len(row) {
				return ""
			}
			return strings.TrimSpace(row[idx])
		}

		fullName := getVal("name")
		if fullName == "" {
			continue // skip empty rows
		}

		// Parse name device if present (e.g. "Nguyen Van A (laptop)")
		cleanName, _ := legacyimport.CleanNameDevice(fullName)
		if cleanName != "" {
			fullName = cleanName
		}

		code := getVal("code")
		if code == "" {
			code = fmt.Sprintf("NV-%04d", rIdx)
		}

		if _, exists := userCodeSet[code]; exists {
			preview.Warnings = append(preview.Warnings, fmt.Sprintf("Dòng %d: Trùng mã nhân viên %s", rIdx+1, code))
		}
		userCodeSet[code] = struct{}{}

		username := getVal("username")
		if username == "" {
			// Auto generate username from name: "Lâm Vũ Trường" -> "truong.lv"
			username = legacyimport.GenerateUsername(fullName)
			if username == "" {
				username = strings.ToLower(code)
			}
		}

		dept := getVal("department")
		if dept != "" {
			deptSet[dept] = struct{}{}
		}

		notes := getVal("notes")
		joinedDate := ""
		if t, rest, err := legacyimport.ParseJoinedNote(notes); err == nil && t != nil {
			joinedDate = t.Format("2006-01-02")
			notes = rest
		}

		// Grants map
		grants := make(map[string]string)
		for cIdx, projName := range projectCols {
			if cIdx < len(row) {
				val := strings.TrimSpace(row[cIdx])
				level, valid := legacyimport.ParseLevel(val)
				if valid && level != "" {
					grants[projName] = level
					preview.TotalGrants++
				}
			}
		}

		uRow := ImportUserRow{
			EmployeeCode:   code,
			FullName:       fullName,
			Username:       username,
			Email:          getVal("email"),
			Phone:          getVal("phone"),
			DepartmentName: dept,
			Role:           "USER",
			Status:         "ACTIVE",
			JoinedDate:     joinedDate,
			Notes:          notes,
			Grants:         grants,
		}

		preview.ValidUsers = append(preview.ValidUsers, uRow)
	}

	preview.TotalUsers = len(preview.ValidUsers)
	for d := range deptSet {
		preview.NewDepartments = append(preview.NewDepartments, d)
	}

	return preview, nil
}

// CommitImport persists previewed users and their permissions into the database
func CommitImport(ctx context.Context, repo *repository.Repository, preview ImportPreview, companyID string, defaultPassword string) (int, error) {
	if defaultPassword == "" {
		defaultPassword = "User@123456"
	}
	hash, err := auth.HashPassword(defaultPassword)
	if err != nil {
		return 0, fmt.Errorf("hash default password: %w", err)
	}

	// 1. Ensure departments exist
	deptMap := make(map[string]string)
	existingDepts, _ := repo.ListDepartments(ctx, companyID, "")
	for _, ed := range existingDepts {
		deptMap[strings.ToLower(strings.TrimSpace(ed.Name))] = ed.ID
	}

	for _, dName := range preview.NewDepartments {
		key := strings.ToLower(strings.TrimSpace(dName))
		if _, exists := deptMap[key]; !exists && strings.TrimSpace(dName) != "" {
			d, err := repo.CreateDepartment(ctx, domain.Department{
				CompanyID: companyID,
				Name:      strings.TrimSpace(dName),
			})
			if err == nil {
				deptMap[key] = d.ID
			}
		}
	}

	// 2. Ensure detected projects exist
	projMap := make(map[string]string)
	existingProjects, _ := repo.ListProjects(ctx, "", companyID)
	for _, ep := range existingProjects {
		projMap[strings.ToLower(strings.TrimSpace(ep.Name))] = ep.ID
		projMap[strings.ToLower(strings.TrimSpace(ep.Code))] = ep.ID
	}

	for _, pName := range preview.DetectedProjects {
		pNameClean := strings.TrimSpace(pName)
		key := strings.ToLower(pNameClean)
		if _, exists := projMap[key]; !exists && pNameClean != "" {
			// Generate a clean code from project name
			code := pNameClean
			if len(code) > 20 {
				code = code[:20]
			}
			p, err := repo.CreateProject(ctx, domain.Project{
				CompanyID:  companyID,
				Code:       code,
				Name:       pNameClean,
				Status:     "ACTIVE",
				FolderPath: fmt.Sprintf("\\\\fileserver\\DSPC\\%s", code),
			})
			if err == nil {
				projMap[key] = p.ID
				projMap[strings.ToLower(code)] = p.ID
			}
		}
	}

	// 3. Insert Users & Permissions
	importedUsers := 0
	for _, uRow := range preview.ValidUsers {
		var deptID *string
		if id, ok := deptMap[strings.ToLower(strings.TrimSpace(uRow.DepartmentName))]; ok {
			deptID = &id
		}

		u := domain.User{
			EmployeeCode: uRow.EmployeeCode,
			Username:     uRow.Username,
			FullName:     uRow.FullName,
			Email:        uRow.Email,
			Phone:        uRow.Phone,
			CompanyID:    companyID,
			DepartmentID: deptID,
			Role:         uRow.Role,
			Status:       "ACTIVE",
			Notes:        uRow.Notes,
		}

		createdUser, err := repo.CreateUser(ctx, u, hash)
		if err != nil {
			// If user already exists by username or employee_code, update their info (e.g. fix character encoding or sync details)
			var existing domain.User
			errFind := repo.DB.QueryRow(ctx, `
				SELECT id, role, status FROM users 
				WHERE company_id = $1 AND (username = $2 OR (employee_code != '' AND employee_code = $3))`,
				companyID, u.Username, u.EmployeeCode,
			).Scan(&existing.ID, &existing.Role, &existing.Status)
			if errFind == nil {
				_, _ = repo.DB.Exec(ctx, `
					UPDATE users 
					SET full_name = $2, 
					    email = COALESCE(NULLIF($3, ''), email),
					    phone = COALESCE(NULLIF($4, ''), phone), 
					    department_id = COALESCE($5, department_id),
					    notes = CASE WHEN notes = '' THEN $6 ELSE notes END,
					    updated_at = NOW()
					WHERE id = $1`,
					existing.ID, u.FullName, u.Email, u.Phone, u.DepartmentID, u.Notes,
				)
				createdUser = existing
			} else {
				// If username already exists with different person, try appending employeeCode
				u.Username = fmt.Sprintf("%s_%s", uRow.Username, uRow.EmployeeCode)
				createdUser, err = repo.CreateUser(ctx, u, hash)
				if err != nil {
					continue
				}
			}
		}
		importedUsers++

		// Set Permissions
		for projName, level := range uRow.Grants {
			pID, ok := projMap[strings.ToLower(strings.TrimSpace(projName))]
			if !ok {
				continue
			}
			_, _ = repo.UpsertPermission(ctx, domain.Permission{
				UserID:    createdUser.ID,
				ProjectID: pID,
				Level:     level,
			})
		}
	}

	return importedUsers, nil
}
