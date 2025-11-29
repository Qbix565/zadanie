cmake_minimum_required(VERSION 3.16)
project(obs-udp-stream VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find LibOBS
find_package(LibOBS REQUIRED)

include_directories(${LIBOBS_INCLUDE_DIRS})

add_library(obs-udp-stream MODULE
    src/plugin-main.cpp
    src/udp-output.cpp
    src/udp-output.h
    src/stb_image_write.h
)

target_link_libraries(obs-udp-stream PRIVATE ${LIBOBS_LIBRARIES})

if(WIN32)
    target_link_libraries(obs-udp-stream PRIVATE ws2_32)
endif()

set_target_properties(obs-udp-stream PROPERTIES PREFIX "")
