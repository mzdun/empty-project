cmake_minimum_required (VERSION 3.25)
project (@APP_NAME@
  DESCRIPTION @QUOTED_APP_DESCRIPTION@
  VERSION 0.2.0
  LANGUAGES CXX
)

set(PROJECT_VERSION_SHORT "${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}")
set(PROJECT_VERSION_STABILITY "" # or "-alpha", or "-beta", or "-rc.1", or "-rc.2"
    CACHE STRING "" FORCE)

if (${CMAKE_CURRENT_SOURCE_DIR} STREQUAL ${CMAKE_CURRENT_BINARY_DIR})
  message(FATAL_ERROR "Building in source firectory is not supported")
endif()

set(@APP_PREFIX@_TESTING ON CACHE BOOL "Compile and/or run self-tests")
set(@APP_PREFIX@_SANITIZE OFF CACHE BOOL "Compile with sanitizers enabled")
set(@APP_PREFIX@_CUTDOWN_OS OFF CACHE BOOL "Run tests on cutdown OS (e.g. GitHub docker)")

set(CMAKE_CXX_STANDARD @CXX_STANDARD@)
set(CMAKE_CXX_EXTENSIONS OFF)

set_property(GLOBAL PROPERTY USE_FOLDERS ON)

list(APPEND CMAKE_MODULE_PATH "${PROJECT_BINARY_DIR}/conan" "${PROJECT_SOURCE_DIR}/cmake")
list(APPEND CMAKE_PREFIX_PATH "${PROJECT_BINARY_DIR}/conan")

set(CONAN_CMAKE_SILENT_OUTPUT ON)
find_package(Python3 COMPONENTS Interpreter REQUIRED)
find_package(ctre REQUIRED)
find_package(fmt REQUIRED)
find_package(mbits-args REQUIRED)

include(output_dirs_setup)
old_conan_output_dirs_setup()

if (MSVC)
  set(ADDITIONAL_WALL_FLAGS
    /D_CRT_SECURE_NO_WARNINGS
    /D_CRT_NONSTDC_NO_WARNINGS
    /utf-8
    /permissive-
    /Zc:__cplusplus
    /W4
    /w14242
    /w14254
    /w14263
    /w14265
    /w14287
    /we4289
    /w14296
    /w14311
    /w14545
    /w14546
    /w14547
    /w14549
    /w14555
    /w14619
    /w14640
    /w14826
    /w14905
    /w14906
    /w14928
    /w14946)
  if (@APP_PREFIX@_SANITIZE)
    list(APPEND ADDITIONAL_WALL_FLAGS
      /fsanitize=address
      /D_DISABLE_VECTOR_ANNOTATION
      /D_DISABLE_STRING_ANNOTATION
    )
  endif()
else()
  set(ADDITIONAL_WALL_FLAGS
      -Wall -Wextra
      -Wnon-virtual-dtor
      -Wold-style-cast
      -Wcast-align
      -Wunused
      -Woverloaded-virtual
      -Wpedantic
      -Wconversion
      -Wsign-conversion
      -Wnull-dereference
      -Wdouble-promotion
      -Wformat=2
  )
  if ("${CMAKE_CXX_COMPILER_ID}" STREQUAL "Clang")
    list(APPEND ADDITIONAL_WALL_FLAGS
      -fcolor-diagnostics
      -Wno-braced-scalar-init
    # -Wlifetime
    )
  else()
    list(APPEND ADDITIONAL_WALL_FLAGS
      -fdiagnostics-color
      -Wmisleading-indentation
      -Wduplicated-cond
      -Wduplicated-branches
      -Wlogical-op
      -Wuseless-cast
      )
  endif()
  if (@APP_PREFIX@_SANITIZE)
    list(APPEND ADDITIONAL_WALL_FLAGS
      -fsanitize=address
      -fsanitize=undefined
      
    )
    list(APPEND ADDITIONAL_LINK_FLAGS
      -fsanitize=address
      -fsanitize=undefined
    )
  endif()
endif()

if (@APP_PREFIX@_SANITIZE)
  message(STATUS "This build is prepared for sanitization")
endif()

include(${PROJECT_SOURCE_DIR}/packages/config.cmake)
include(CPack)

set(BINARY_DIR bin)
set(ROOT_DIR "..")

message(STATUS "Sanitizer: ${@APP_PREFIX@_SANITIZE}")

include(vs17-no-modules)

set(SOURCES
    src/entry_point.cc
    src/main.cc
)

source_group(TREE ${CMAKE_CURRENT_SOURCE_DIR} FILES ${SOURCES})

configure_file(src/version.hh.in ${CMAKE_CURRENT_BINARY_DIR}/src/version.hh @ONLY)

add_executable(${PROJECT_NAME} ${SOURCES})
target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_BINARY_DIR}/src)

target_link_libraries(${PROJECT_NAME} PRIVATE
    ctre::ctre
    fmt::fmt
    mbits::args
)

if (WIN32)
    target_compile_options(${PROJECT_NAME} PUBLIC /D_UNICODE /DUNICODE)
    target_link_options(${PROJECT_NAME} PRIVATE /ENTRY:wmainCRTStartup)
    fix_vs_modules(${PROJECT_NAME})
endif()

install(TARGETS ${PROJECT_NAME}
    RUNTIME DESTINATION ${BINARY_DIR}
    COMPONENT main_exec
)

cpack_add_component(main_exec
    DISPLAY_NAME "Main executable"
    GROUP apps
)

cpack_add_component_group(apps
    DISPLAY_NAME "Executables"
    EXPANDED
)
