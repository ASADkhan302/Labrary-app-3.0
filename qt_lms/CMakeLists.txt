cmake_minimum_required(VERSION 3.16)
project(ULM_LibraryManagementSystem VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 REQUIRED COMPONENTS 
    Core 
    Gui 
    Widgets 
    Sql 
    Charts 
    PrintSupport 
    Multimedia
)

set(SOURCES
    src/main.cpp
    src/StorageSetupDialog.cpp
    src/DatabaseManager.cpp
    src/CatalogModel.cpp
    src/BookFormDialog.cpp
    src/MainWindow.cpp
    src/CsvWizardDialog.cpp
    src/SettingsPage.cpp
    src/AudioFeedback.cpp
    src/BarcodeScannerFilter.cpp
    src/BorrowerDialog.cpp
    src/BorrowersPage.cpp
    src/CirculationPage.cpp
    src/Code128Barcode.cpp
    src/LabelPrintDialog.cpp
    src/ReportsPage.cpp
    src/BootSplashScreen.cpp
)

set(HEADERS
    src/Models.h
    src/StorageSetupDialog.h
    src/DatabaseManager.h
    src/CatalogModel.h
    src/BookFormDialog.h
    src/MainWindow.h
    src/CsvWizardDialog.h
    src/SettingsPage.h
    src/AudioFeedback.h
    src/BarcodeScannerFilter.h
    src/BorrowerDialog.h
    src/BorrowersPage.h
    src/CirculationPage.h
    src/Code128Barcode.h
    src/LabelPrintDialog.h
    src/ReportsPage.h
    src/BootSplashScreen.h
)

set(RESOURCES
    resources.qrc
)

add_executable(${PROJECT_NAME} WIN32
    ${SOURCES}
    ${HEADERS}
    ${RESOURCES}
)

target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::Sql
    Qt6::Charts
    Qt6::PrintSupport
    Qt6::Multimedia
)

target_include_directories(${PROJECT_NAME} PRIVATE src)

if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE /W4 /permissive-)
else()
    target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -Wpedantic)
endif()
