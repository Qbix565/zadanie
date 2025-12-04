#include "udp-output.h"
#include <obs-module.h>
#include <util/platform.h>
#include <util/threading.h>
#include <winsock2.h>
#include <ws2tcpip.h>

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

#include <vector>
#include <string>

struct udp_stream_data {
    obs_source_t *context;
    SOCKET sock;
    struct sockaddr_in dest_addr;
    std::string ip;
    int port;
    int quality;
    
    video_scaler_t *scaler;
    uint32_t width;
    uint32_t height;
    enum video_format format;
    
    std::vector<uint8_t> buffer;      // For RGBA data
    std::vector<uint8_t> jpeg_buffer; // For JPEG output
};

// ... (keep existing functions)

// STB Image Write Callback
static void write_func(void *context, void *data, int size)
{
    udp_stream_data *s = (udp_stream_data *)context;
    size_t current_size = s->jpeg_buffer.size();
    s->jpeg_buffer.resize(current_size + size);
    memcpy(s->jpeg_buffer.data() + current_size, data, size);
}

static struct obs_source_frame *udp_stream_filter_video(void *data, struct obs_source_frame *frame)
{
    udp_stream_data *s = (udp_stream_data *)data;

    if (!s->context) return frame;

    // Check if we need to update scaler
    if (s->width != frame->width || s->height != frame->height || s->format != frame->format) {
        if (s->scaler) {
            video_scaler_destroy(s->scaler);
            s->scaler = nullptr;
        }
        s->width = frame->width;
        s->height = frame->height;
        s->format = frame->format;
        
        struct video_scale_info dst_info = {0};
        dst_info.format = VIDEO_FORMAT_RGBA;
        dst_info.width = frame->width;
        dst_info.height = frame->height;
        dst_info.range = VIDEO_RANGE_DEFAULT;
        dst_info.colorspace = VIDEO_CS_DEFAULT;

        struct video_scale_info src_info = {0};
        src_info.format = frame->format;
        src_info.width = frame->width;
        src_info.height = frame->height;
        src_info.range = frame->range;
        src_info.colorspace = frame->colorspace;

        int ret = video_scaler_create(&s->scaler, &dst_info, &src_info, VIDEO_SCALE_DEFAULT);
        if (ret != VIDEO_SCALER_SUCCESS) {
            blog(LOG_ERROR, "UDP Stream: Failed to create scaler");
        }
    }

    if (s->scaler) {
        // Scale/Convert to RGBA
        uint32_t linesize[MAX_AV_PLANES] = {0};
        uint8_t *data[MAX_AV_PLANES] = {0};
        
        // Allocate temp buffer for RGBA
        // 4 bytes per pixel
        size_t size = s->width * s->height * 4;
        if (s->buffer.size() != size) {
            s->buffer.resize(size);
        }
        
        data[0] = s->buffer.data();
        linesize[0] = s->width * 4;

        bool success = video_scaler_scale(s->scaler, data, linesize, 
                                          (const uint8_t *const *)frame->data, (const uint32_t *)frame->linesize);

        if (success) {
            // Clear JPEG buffer
            s->jpeg_buffer.clear();
            
            // Encode to JPEG (writes to jpeg_buffer via write_func)
            stbi_write_jpg_to_func(write_func, s, s->width, s->height, 4, s->buffer.data(), s->quality);
            
            // Send the entire JPEG as one packet
            if (s->sock != INVALID_SOCKET && !s->jpeg_buffer.empty()) {
                // Check size limit for UDP (approx 65507 bytes)
                if (s->jpeg_buffer.size() <= 65507) {
                    sendto(s->sock, (const char *)s->jpeg_buffer.data(), (int)s->jpeg_buffer.size(), 0, (struct sockaddr *)&s->dest_addr, sizeof(s->dest_addr));
                } else {
                    // Too big for single UDP packet. 
                    // For now, just drop or maybe log once?
                    // blog(LOG_WARNING, "UDP Stream: Frame too large for UDP (%zu bytes)", s->jpeg_buffer.size());
                }
            }
        }
    }

    return frame;
}

struct obs_source_info udp_stream_filter_info = {
    .id = "udp_stream_filter",
    .type = OBS_SOURCE_TYPE_FILTER,
    .output_flags = OBS_SOURCE_VIDEO,
    .get_name = udp_stream_get_name,
    .create = udp_stream_create,
    .destroy = udp_stream_destroy,
    .get_properties = udp_stream_properties,
    .update = udp_stream_update,
    .filter_video = udp_stream_filter_video,
};
